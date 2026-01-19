import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { LocalTime } from './local-time';

describe('LocalTime', () => {
  const iso = '2026-10-05T16:40:00.000Z';

  it('server-renders a timezone-independent date so hydration matches', () => {
    expect(renderToString(<LocalTime iso={iso} />)).toContain('Oct 5, 2026');
  });

  it('renders a relative time in the browser', () => {
    vi.useFakeTimers({ now: new Date('2026-10-05T17:10:00.000Z') });
    render(<LocalTime iso={iso} mode="relative" />);
    expect(screen.getByText('30 minutes ago')).toHaveAttribute('datetime', iso);
    vi.useRealTimers();
  });
});
