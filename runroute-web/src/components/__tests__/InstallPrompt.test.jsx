import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../../lib/i18n.js';

const auth = { loginVisible: false };
vi.mock('../../state/AuthProvider.jsx', () => ({ useAuth: () => auth }));

// vi.hoisted: vi.mock is lifted above the file, so its factory cannot close over
// an ordinary top-level const.
const pwa = vi.hoisted(() => ({
  getPlatform: vi.fn(() => 'ios'),
  hasNativePrompt: vi.fn(() => false),
  isDismissed: vi.fn(() => false),
  isStandalone: vi.fn(() => false),
  onInstallAvailable: vi.fn(() => () => {}),
  promptInstall: vi.fn(async () => true),
  setDismissed: vi.fn(),
}));
vi.mock('../../lib/pwa.js', () => pwa);

const settings = { getSafetyAcked: vi.fn(() => true) };
vi.mock('../../lib/settings.js', async (orig) => ({
  ...(await orig()),
  getSafetyAcked: () => settings.getSafetyAcked(),
}));

import InstallPrompt from '../InstallPrompt.jsx';
import { SettingsProvider } from '../../state/SettingsProvider.jsx';

const t = (key) => translate('he', key);

function renderPrompt() {
  localStorage.setItem('maway:lang', 'he');
  return render(
    <SettingsProvider>
      <InstallPrompt />
    </SettingsProvider>,
  );
}

beforeEach(() => {
  auth.loginVisible = false;
  settings.getSafetyAcked.mockReturnValue(true);
  pwa.getPlatform.mockReturnValue('ios');
  pwa.hasNativePrompt.mockReturnValue(false);
  pwa.isDismissed.mockReturnValue(false);
  pwa.isStandalone.mockReturnValue(false);
  pwa.promptInstall.mockResolvedValue(true);
});

describe('InstallPrompt — when it stays out of the way', () => {
  it('says nothing once the app is already installed', () => {
    pwa.isStandalone.mockReturnValue(true);
    const { container } = renderPrompt();
    expect(container).toBeEmptyDOMElement();
  });

  it('never comes back after being dismissed', () => {
    pwa.isDismissed.mockReturnValue(true);
    const { container } = renderPrompt();
    expect(container).toBeEmptyDOMElement();
  });

  it('waits behind the login gate', () => {
    // First open already stacks the gate and the safety notice; a third card on
    // top of them reads as spam.
    auth.loginVisible = true;
    const { container } = renderPrompt();
    expect(container).toBeEmptyDOMElement();
  });

  it('waits behind the safety notice', () => {
    settings.getSafetyAcked.mockReturnValue(false);
    const { container } = renderPrompt();
    expect(container).toBeEmptyDOMElement();
  });

  it('stays hidden on a desktop browser that cannot install', () => {
    pwa.getPlatform.mockReturnValue('desktop');
    const { container } = renderPrompt();
    expect(container).toBeEmptyDOMElement();
  });

  it('still appears on desktop when a real install prompt exists', () => {
    pwa.getPlatform.mockReturnValue('desktop');
    pwa.hasNativePrompt.mockReturnValue(true);
    renderPrompt();
    expect(screen.getByRole('button', { name: t('install.action') })).toBeInTheDocument();
  });
});

describe('InstallPrompt — what each platform is told', () => {
  it('explains the Share sheet on iOS, where there is no install API', () => {
    renderPrompt();
    expect(screen.getByText(t('install.bodyIos'))).toBeInTheDocument();
    // Nothing to tap — offering a button that cannot install would be a lie.
    expect(screen.queryByRole('button', { name: t('install.action') })).not.toBeInTheDocument();
  });

  it('offers a one-tap install where the browser supports it', () => {
    pwa.getPlatform.mockReturnValue('android');
    pwa.hasNativePrompt.mockReturnValue(true);
    renderPrompt();
    expect(screen.getByText(t('install.body'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('install.action') })).toBeInTheDocument();
  });

  it('falls back to instructions on Android before the event arrives', () => {
    pwa.getPlatform.mockReturnValue('android');
    pwa.hasNativePrompt.mockReturnValue(false);
    renderPrompt();
    expect(screen.queryByRole('button', { name: t('install.action') })).not.toBeInTheDocument();
    expect(screen.getByText(t('install.body'))).toBeInTheDocument();
  });

  it('upgrades to a real button when the install event arrives after mount', async () => {
    let notify;
    pwa.onInstallAvailable.mockImplementation((fn) => {
      notify = fn;
      return () => {};
    });
    pwa.getPlatform.mockReturnValue('android');
    renderPrompt();
    expect(screen.queryByRole('button', { name: t('install.action') })).not.toBeInTheDocument();

    notify(true); // Chrome decided the app qualifies

    expect(
      await screen.findByRole('button', { name: t('install.action') }),
    ).toBeInTheDocument();
  });
});

describe('InstallPrompt — dismissing', () => {
  it('remembers "not now" so it does not nag', async () => {
    const user = userEvent.setup();
    renderPrompt();

    await user.click(screen.getByRole('button', { name: t('install.dismiss') }));

    expect(pwa.setDismissed).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(t('install.title'))).not.toBeInTheDocument();
  });

  it('does not ask again after the native prompt, whatever the user chose', async () => {
    const user = userEvent.setup();
    pwa.getPlatform.mockReturnValue('android');
    pwa.hasNativePrompt.mockReturnValue(true);
    pwa.promptInstall.mockResolvedValue(false); // user declined the browser dialog
    renderPrompt();

    await user.click(screen.getByRole('button', { name: t('install.action') }));

    await waitFor(() => expect(pwa.setDismissed).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(t('install.title'))).not.toBeInTheDocument();
  });
});
