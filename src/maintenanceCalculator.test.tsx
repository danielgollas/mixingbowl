import { fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';
import { today } from './lib/clock';
import { STORAGE_KEY, defaultData, type AppData } from './lib/storage';

const stored = (): AppData => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
const type = (label: string, value: string) => fireEvent.input(screen.getByLabelText(label), { target: { value } });
const pick = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const open = () => fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));

function fill() {
  type('Current weight', '176');
  type('Height, feet', '5');
  type('Height, inches', '11');
  type('Age', '35');
  pick('Sex', 'male');
  pick('Activity', 'moderate');
}

describe('maintenance calculator', () => {
  beforeEach(() => {
    localStorage.clear();
    history.replaceState(null, '', '#/settings');
  });

  it('estimates from the answers, and Use this fills in maintenance and saves them', async () => {
    render(<App storage={localStorage} cloud={null} />);
    open();
    fill();
    expect(screen.getByRole('status').textContent).toContain('2,720 kcal/day');
    fireEvent.click(screen.getByRole('button', { name: 'Use this' }));
    await waitFor(() => expect(stored().people[0].maintenance).toBe(2720));
    const saved = stored().people[0].body!;
    expect(saved).toMatchObject({ age: 35, sex: 'male', activity: 'moderate' });
    expect(saved.weightKg).toBeCloseTo(79.8, 1);
    expect(saved.heightCm).toBeCloseTo(180.3, 1);
    expect((screen.getByLabelText('Maintenance calories') as HTMLInputElement).value).toBe('2720');
    expect(screen.queryByLabelText('Age')).toBeNull();
  });

  it('shows no estimate until every answer is in', () => {
    render(<App storage={localStorage} cloud={null} />);
    open();
    type('Current weight', '176');
    expect(screen.queryByRole('button', { name: 'Use this' })).toBeNull();
  });

  it('starts from the saved answers, in the chosen unit', () => {
    const data = defaultData(today());
    data.settings.unit = 'kg';
    data.people[0].body = { weightKg: 80, heightCm: 180, age: 35, sex: 'female', activity: 'light' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    render(<App storage={localStorage} cloud={null} />);
    open();
    expect((screen.getByLabelText('Current weight') as HTMLInputElement).value).toBe('80');
    expect((screen.getByLabelText('Height') as HTMLInputElement).value).toBe('180');
    expect((screen.getByLabelText('Sex') as HTMLSelectElement).value).toBe('female');
  });

  it('changes nothing when closed without using the estimate', () => {
    render(<App storage={localStorage} cloud={null} />);
    open();
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(stored()?.people?.[0].body ?? null).toBeNull();
    expect(stored()?.people?.[0].maintenance ?? null).toBeNull();
  });
});
