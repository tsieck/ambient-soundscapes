import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { CurrentPlace } from '../src/storage';

type AudioProbe = Window & {
  __contexts: AudioContext[];
  __analysers: AnalyserNode[];
  __sourceStarts: number;
};

// Observe the real Web Audio context and its final output without replacing DSP.
async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    const probe = window as unknown as AudioProbe;
    probe.__contexts = [];
    probe.__analysers = [];
    probe.__sourceStarts = 0;
    const track = <T extends AudioScheduledSourceNode>(source: T): T => {
      source.start = new Proxy(source.start, {
        apply(target, receiver, args) {
          probe.__sourceStarts++;
          return Reflect.apply(target, receiver, args);
        },
      });
      return source;
    };
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        probe.__contexts.push(this);
      }
      override createAnalyser() {
        const analyser = super.createAnalyser();
        probe.__analysers.push(analyser);
        return analyser;
      }
      override createOscillator() { return track(super.createOscillator()); }
      override createBufferSource() { return track(super.createBufferSource()); }
    };
  });
}

async function outputLevel(page: Page) {
  return page.evaluate(() => {
    const analyser = (window as unknown as AudioProbe).__analysers[0];
    if (!analyser) return 0;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((sum, value) => sum + value * value, 0) / data.length);
  });
}

async function currentPlace(page: Page): Promise<CurrentPlace> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('stillroom.current.v1')!));
}

async function chooseSound(page: Page, name: string) {
  await page.getByRole('button', { name: 'Choose sound preset' }).click();
  await page.getByRole('dialog').getByRole('button', { name: new RegExp(name) }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

test('starts silently, plays real audio, mutes, restores volume, and suspends on pause', async ({ page }) => {
  await observeAudio(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play soundscape' })).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as AudioProbe).__contexts.length)).toBe(0);

  await page.getByRole('button', { name: 'Play soundscape' }).click();
  await expect(page.getByRole('button', { name: 'Pause soundscape' })).toBeEnabled();
  await expect.poll(() => outputLevel(page)).toBeGreaterThan(0.00001);
  await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
  await expect(page.getByLabel('Master volume')).toHaveValue('0');
  await expect.poll(() => outputLevel(page)).toBeLessThan(0.000001);
  await page.getByRole('button', { name: 'Unmute sound', exact: true }).click();
  await expect(page.getByLabel('Master volume')).toHaveValue('50');
  await expect.poll(() => outputLevel(page)).toBeGreaterThan(0.00001);

  await page.getByRole('button', { name: /Faded afternoon/ }).click();
  await expect(page.getByRole('button', { name: /Faded afternoon/ })).toHaveAttribute('aria-pressed', 'true');
  const startsBeforeSound = await page.evaluate(() => (window as unknown as AudioProbe).__sourceStarts);
  await chooseSound(page, 'Glass garden');
  await expect.poll(() => page.evaluate(() => (window as unknown as AudioProbe).__sourceStarts)).toBeGreaterThan(startsBeforeSound);
  const beforeVariation = await currentPlace(page);
  const startsBeforeVariation = await page.evaluate(() => (window as unknown as AudioProbe).__sourceStarts);
  await page.getByRole('button', { name: 'New variation', exact: true }).click();
  expect((await currentPlace(page)).identity.seed).not.toBe(beforeVariation.identity.seed);
  await expect.poll(() => page.evaluate(() => (window as unknown as AudioProbe).__sourceStarts)).toBeGreaterThan(startsBeforeVariation);
  await expect(page.getByRole('button', { name: 'Pause soundscape' })).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as AudioProbe).__contexts.length)).toBe(1);
  await expect.poll(() => outputLevel(page)).toBeGreaterThan(0.00001);

  await page.getByRole('button', { name: 'Pause soundscape' }).click();
  await expect(page.getByRole('button', { name: 'Play soundscape' })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => (window as unknown as AudioProbe).__contexts[0].state)).toBe('suspended');
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as AudioProbe).__contexts.length)).toBe(0);
  await expect(page.getByRole('button', { name: 'Play soundscape' })).toBeVisible();
});

test('live controls and landscapes preserve the running sound graph without restarting music', async ({ page }) => {
  await observeAudio(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Play soundscape' }).click();
  await expect.poll(() => outputLevel(page)).toBeGreaterThan(0.00001);
  await page.getByRole('button', { name: 'Open the synth', exact: true }).click();
  const starts = await page.evaluate(() => (window as unknown as AudioProbe).__sourceStarts);
  const identity = (await currentPlace(page)).identity;
  expect(starts).toBeGreaterThan(0);
  for (const name of ['Warmth', 'Darkness', 'Movement', 'Rain', 'Master volume', 'Space', 'Density', 'Drift', 'Harmony']) {
    await page.getByLabel(name, { exact: true }).press('End');
    await expect(page.getByRole('button', { name: 'Pause soundscape' })).toBeEnabled();
    expect(await page.evaluate(() => (window as unknown as AudioProbe).__sourceStarts)).toBe(starts);
  }
  await page.getByRole('button', { name: /Faded afternoon/ }).click();
  expect(await page.evaluate(() => (window as unknown as AudioProbe).__sourceStarts)).toBe(starts);
  expect((await currentPlace(page)).identity).toEqual(identity);
  expect(await page.evaluate(() => (window as unknown as AudioProbe).__contexts.map(context => context.state))).toEqual(['running']);
  await page.getByRole('button', { name: 'Pause soundscape' }).click();
  await expect(page.getByRole('button', { name: 'Play soundscape' })).toBeEnabled();
});

test('ten sound presets set defaults while scenery, volume, and rain remain independent', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Master volume').press('End');
  await page.getByLabel('Rain', { exact: true }).press('End');
  await page.getByRole('button', { name: 'Choose sound preset' }).click();
  await expect(page.getByRole('dialog').locator('button[aria-pressed="false"]')).toHaveCount(9);
  await expect(page.getByRole('dialog').getByRole('button', { pressed: true })).toHaveCount(1);
  await page.getByRole('dialog').getByRole('button', { name: /Tape afternoon/ }).click();
  await expect(page.getByRole('button', { name: 'Choose sound preset' })).toBeFocused();
  const sound = await currentPlace(page);
  await page.getByRole('button', { name: /Faded afternoon/ }).click();
  await expect(page.getByRole('heading', { name: 'Tape afternoon' })).toBeVisible();
  expect(await currentPlace(page)).toEqual({ ...sound, atmosphere: 'afternoon' });
  for (const [name, value] of Object.entries({ Warmth: '86', Darkness: '34', Movement: '37', Rain: '100', 'Master volume': '100' })) {
    await expect(page.getByLabel(name, { exact: true })).toHaveValue(value);
  }
  await page.getByLabel('Warmth', { exact: true }).press('Home');
  await page.getByLabel('Movement', { exact: true }).press('End');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByLabel('Warmth', { exact: true })).toHaveValue('86');
  await expect(page.getByLabel('Movement', { exact: true })).toHaveValue('37');
  await expect(page.getByLabel('Master volume')).toHaveValue('100');
  await expect(page.getByLabel('Rain', { exact: true })).toHaveValue('100');
  await page.getByRole('button', { name: /Rainy city/ }).click();
  expect(await currentPlace(page)).toEqual(sound);
});

test('variations change synth identity and parameters, with undo preserving current volume', async ({ page }) => {
  await page.goto('/');
  await chooseSound(page, 'Quiet orbit');
  await page.getByLabel('Rain', { exact: true }).press('End');
  await page.getByLabel('Master volume').press('End');
  const original = await currentPlace(page);
  await page.getByRole('button', { name: 'New variation', exact: true }).click();
  const variation = await currentPlace(page);
  expect(variation.identity.preset).toBe('orbit');
  expect(variation.identity.seed).not.toBe(original.identity.seed);
  expect(variation.settings).not.toEqual(original.settings);
  expect(variation.settings.rain).toBe(1);
  expect(variation.settings.volume).toBe(1);
  await page.getByLabel('Master volume').press('Home');
  await page.getByRole('button', { name: 'Previous variation', exact: true }).click();
  expect(await currentPlace(page)).toEqual({ ...original, settings: { ...original.settings, volume: 0 } });
  await page.getByRole('button', { name: 'Open the synth', exact: true }).click();
  await expect(page.getByText(`VARIATION ${original.identity.seed.toString(16).padStart(8, '0').toUpperCase()}`)).toBeVisible();
});

test('saves full synth identity and advanced controls, persists them, restores and deletes the place', async ({ page }) => {
  await page.goto('/');
  await chooseSound(page, 'Glass garden');
  await page.getByRole('button', { name: 'New variation', exact: true }).click();
  await page.getByRole('button', { name: /Faded afternoon/ }).click();
  await page.getByLabel('Warmth', { exact: true }).press('Home');
  await page.getByLabel('Rain', { exact: true }).press('End');
  await page.getByRole('button', { name: 'Open the synth', exact: true }).click();
  await page.getByLabel('Space', { exact: true }).press('End');
  await page.getByLabel('Density', { exact: true }).press('Home');
  await page.getByLabel('Drift', { exact: true }).press('End');
  await page.getByLabel('Harmony', { exact: true }).press('Home');
  const savedSound = await currentPlace(page);
  await page.getByRole('button', { name: 'Save this place', exact: true }).click();
  await page.getByLabel('Name your place').fill('My quiet afternoon');
  await page.getByRole('button', { name: 'Save place', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save this place', exact: true })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Glass garden' })).toBeVisible();
  expect(await currentPlace(page)).toEqual(savedSound);
  await chooseSound(page, 'Ember glow');
  await page.getByRole('button', { name: /Rainy city/ }).click();
  await page.getByLabel('Master volume').press('End');
  await page.getByRole('button', { name: /Saved places/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^My quiet afternoon/ }).click();
  await expect(page.getByRole('heading', { name: 'Glass garden' })).toBeVisible();
  expect(await currentPlace(page)).toEqual(savedSound);
  await page.getByRole('button', { name: 'Open the synth', exact: true }).click();
  for (const [name, value] of Object.entries({ Warmth: '0', Rain: '100', Space: '100', Density: '0', Drift: '100', Harmony: '0' })) {
    await expect(page.getByLabel(name, { exact: true })).toHaveValue(value);
  }
  await page.getByRole('button', { name: /Saved places/ }).click();
  await page.getByRole('button', { name: 'Delete My quiet afternoon' }).click();
  await expect(page.getByText('No places saved yet.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Saved places/ }).click();
  await expect(page.getByText('No places saved yet.')).toBeVisible();
});

test('malformed browser data falls back without breaking the controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('stillroom.current.v1', JSON.stringify({ atmosphere: 'afternoon', settings: { warmth: 7 } }));
    localStorage.setItem('stillroom.saved.v1', '{broken json');
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Velvet room' })).toBeVisible();
  await expect(page.getByLabel('Warmth', { exact: true })).toHaveValue('78');
  await page.getByRole('button', { name: /Saved places/ }).click();
  await expect(page.getByText('No places saved yet.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('older saved atmospheres gain a synth identity without losing their original controls', async ({ page }) => {
  await page.addInitScript(() => {
    const oldPlace = { atmosphere: 'afternoon', settings: { warmth: .31, darkness: .41, movement: .51, rain: .11, volume: .61 } };
    localStorage.setItem('stillroom.current.v1', JSON.stringify(oldPlace));
    localStorage.setItem('stillroom.saved.v1', JSON.stringify([{ ...oldPlace, id: 'old-place', name: 'Old favorite' }]));
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tape afternoon' })).toBeVisible();
  const migrated = await currentPlace(page);
  expect(migrated.identity).toEqual({ preset: 'tape', seed: 7103 });
  expect(migrated.settings).toMatchObject({ warmth: .31, darkness: .41, movement: .51, rain: .11, volume: .61 });
  for (const key of ['space', 'density', 'drift', 'tension'] as const) {
    expect(migrated.settings[key]).toBeGreaterThanOrEqual(0);
    expect(migrated.settings[key]).toBeLessThanOrEqual(1);
  }
  await chooseSound(page, 'Glass garden');
  await page.getByRole('button', { name: /Saved places/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^Old favorite/ }).click();
  expect(await currentPlace(page)).toEqual(migrated);
});

test('unavailable storage explains the limitation and does not falsely save a place', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.setItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  });
  await page.goto('/');
  await expect(page.getByText('Browser storage is unavailable. Your changes will last for this visit.')).toBeVisible();
  await page.getByLabel('Warmth', { exact: true }).press('End');
  await expect(page.getByLabel('Warmth', { exact: true })).toHaveValue('100');
  await page.getByRole('button', { name: 'Save this place', exact: true }).click();
  await page.getByLabel('Name your place').fill('Cannot persist');
  await page.getByRole('button', { name: 'Save place', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('could not save this place');
});

test('dialog traps focus, accepts spaces in the name, and returns focus after Escape', async ({ page }) => {
  await observeAudio(page);
  await page.goto('/');
  const saveButton = page.getByRole('button', { name: 'Save this place', exact: true });
  await saveButton.click();
  const name = page.getByLabel('Name your place');
  await expect(name).toBeFocused();
  await name.fill('My');
  await name.press('End');
  await page.keyboard.press('Space');
  await expect(name).toHaveValue('My ');
  expect(await page.evaluate(() => (window as unknown as AudioProbe).__contexts.length)).toBe(0);
  for (let step = 0; step < 5; step++) {
    await page.keyboard.press('Tab');
    // Native modal focus can visit browser chrome; it must not visit the page beneath.
    expect(await page.evaluate(() => !document.hasFocus() || !!document.activeElement?.closest('dialog'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(saveButton).toBeFocused();

  const libraryButton = page.getByRole('button', { name: /Saved places/ });
  await libraryButton.click();
  await page.getByRole('button', { name: 'Save your first place' }).click();
  await expect(name).toBeFocused();
  await page.getByRole('button', { name: 'Save place', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(libraryButton).toBeFocused();
});

test('Space toggles listening and Escape exits focus view from its focused button', async ({ page }) => {
  await observeAudio(page);
  await page.goto('/');
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause soundscape' })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => (window as unknown as AudioProbe).__contexts[0]?.state)).toBe('running');
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Play soundscape' })).toBeEnabled();
  await page.getByRole('button', { name: 'Just listen', exact: true }).click();
  await expect(page.getByRole('button', { name: /Show controls/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Shape your atmosphere' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Just listen', exact: true })).toBeFocused();
});

for (const width of [320, 390, 768]) {
  test(`fits a ${width}px viewport and keeps all visible buttons named`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Just listen', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Open the synth', exact: true }).click();
    for (const name of ['Warmth', 'Darkness', 'Movement', 'Rain', 'Master volume', 'Space', 'Density', 'Drift', 'Harmony']) {
      await expect(page.getByLabel(name, { exact: true })).toBeVisible();
    }
    for (const button of await page.getByRole('button').all()) {
      await expect(button).toHaveAccessibleName(/\S/);
    }
    const overflow = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      const elements = [...document.querySelectorAll('.app-shell button, .app-shell input, .app-shell h1')];
      return elements.filter(element => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && (box.left < -1 || box.right > viewport + 1);
      }).map(element => element.outerHTML.slice(0, 180));
    });
    expect(overflow).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
}
