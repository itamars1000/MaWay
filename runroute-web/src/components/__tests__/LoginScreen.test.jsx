import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../../lib/i18n.js';

// The screen is driven entirely by useAuth(); mock it so each test decides what
// sign-in / sign-up return without touching Supabase.
const auth = {
  loginVisible: true,
  guest: false,
  signInWithGoogle: vi.fn(),
  signUpWithEmail: vi.fn(),
  signInWithEmail: vi.fn(),
  continueAsGuest: vi.fn(),
  dismissLogin: vi.fn(),
};
vi.mock('../../state/AuthProvider.jsx', () => ({ useAuth: () => auth }));

import LoginScreen from '../LoginScreen.jsx';
import { SettingsProvider } from '../../state/SettingsProvider.jsx';

/** Hebrew is the product language — pin it so copy assertions are stable. */
const t = (key, vars) => translate('he', key, vars);

function renderLogin() {
  localStorage.setItem('maway:lang', 'he');
  return render(
    <SettingsProvider>
      <LoginScreen />
    </SettingsProvider>,
  );
}

const emailBox = () => screen.getByLabelText(t('login.emailLabel'));
const passwordBox = () => screen.getByLabelText(t('login.passwordLabel'));
const confirmBox = () => screen.getByLabelText(t('login.confirmLabel'));
// In sign-in mode the submit button is the only "כניסה" (the footer link says
// "הרשמה"); in sign-up mode both say "הרשמה" and the submit one comes first.
const signInSubmit = () => screen.getByRole('button', { name: t('login.signIn') });
const signUpSubmit = () => screen.getAllByRole('button', { name: t('login.signUp') })[0];

beforeEach(() => {
  auth.loginVisible = true;
  auth.guest = false;
  auth.signInWithEmail.mockResolvedValue({ ok: true });
  auth.signUpWithEmail.mockResolvedValue({ ok: true, needsConfirm: false });
});

describe('LoginScreen — gate visibility', () => {
  it('renders nothing when the user is already signed in', () => {
    auth.loginVisible = false;
    const { container } = renderLogin();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a modal dialog when signed out', () => {
    renderLogin();
    const dialog = screen.getByRole('dialog', { name: t('login.ariaLabel') });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});

describe('LoginScreen — sign-in mode', () => {
  it('starts in sign-in mode: no confirm field, no back button', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: t('login.headingSignIn') })).toBeInTheDocument();
    expect(screen.queryByLabelText(t('login.confirmLabel'))).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('login.back') })).not.toBeInTheDocument();
  });

  it('submits the trimmed email and the password', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(emailBox(), '  runner@maway.app  ');
    await user.type(passwordBox(), 'secret123');
    await user.click(signInSubmit());

    await waitFor(() =>
      expect(auth.signInWithEmail).toHaveBeenCalledWith('runner@maway.app', 'secret123'),
    );
    expect(auth.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('shows the mapped error message when the credentials are rejected', async () => {
    const user = userEvent.setup();
    auth.signInWithEmail.mockResolvedValue({ ok: false, code: 'badCreds' });
    renderLogin();

    await user.type(emailBox(), 'runner@maway.app');
    await user.type(passwordBox(), 'nope123');
    await user.click(signInSubmit());

    expect(await screen.findByRole('alert')).toHaveTextContent(t('login.err.badCreds'));
  });

  it('disables the button and shows the working label while in flight', async () => {
    const user = userEvent.setup();
    let resolve;
    auth.signInWithEmail.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    renderLogin();

    await user.type(emailBox(), 'runner@maway.app');
    await user.type(passwordBox(), 'secret123');
    await user.click(signInSubmit());

    expect(screen.getByRole('button', { name: t('login.working') })).toBeDisabled();

    resolve({ ok: true });
    await waitFor(() => expect(signInSubmit()).toBeEnabled());
  });

  it('does not submit twice while a request is in flight', async () => {
    const user = userEvent.setup();
    auth.signInWithEmail.mockReturnValue(new Promise(() => {}));
    renderLogin();

    await user.type(emailBox(), 'runner@maway.app');
    await user.type(passwordBox(), 'secret123');
    await user.click(signInSubmit());
    await user.click(screen.getByRole('button', { name: t('login.working') }));

    expect(auth.signInWithEmail).toHaveBeenCalledTimes(1);
  });

  it('keeps the browser from submitting empty required fields', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(signInSubmit());
    expect(auth.signInWithEmail).not.toHaveBeenCalled();
  });

  it('calls Google sign-in from the social button', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: t('login.google') }));
    expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1);
  });
});

describe('LoginScreen — switching modes', () => {
  it('switches to sign-up and back again', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: t('login.signUp') }));
    expect(screen.getByRole('heading', { name: t('login.headingSignUp') })).toBeInTheDocument();
    expect(confirmBox()).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t('login.back') }));
    expect(screen.getByRole('heading', { name: t('login.headingSignIn') })).toBeInTheDocument();
    expect(screen.queryByLabelText(t('login.confirmLabel'))).not.toBeInTheDocument();
  });

  it('clears a pending error when the mode changes', async () => {
    const user = userEvent.setup();
    auth.signInWithEmail.mockResolvedValue({ ok: false, code: 'badCreds' });
    renderLogin();

    await user.type(emailBox(), 'runner@maway.app');
    await user.type(passwordBox(), 'nope123');
    await user.click(signInSubmit());
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t('login.signUp') }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the typed email when switching modes', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(emailBox(), 'runner@maway.app');
    await user.click(screen.getByRole('button', { name: t('login.signUp') }));

    expect(emailBox()).toHaveValue('runner@maway.app');
  });
});

describe('LoginScreen — sign-up mode', () => {
  async function goToSignUp(user) {
    renderLogin();
    await user.click(screen.getByRole('button', { name: t('login.signUp') }));
  }

  async function fillSignUp(user, { password = 'secret123', confirm = 'secret123' } = {}) {
    await user.type(emailBox(), 'runner@maway.app');
    await user.type(passwordBox(), password);
    await user.type(confirmBox(), confirm);
    await user.click(signUpSubmit());
  }

  it('rejects mismatched passwords without calling the API', async () => {
    const user = userEvent.setup();
    await goToSignUp(user);
    await fillSignUp(user, { confirm: 'secret124' });

    expect(await screen.findByRole('alert')).toHaveTextContent(t('login.err.mismatch'));
    expect(auth.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('signs up when both passwords match', async () => {
    const user = userEvent.setup();
    await goToSignUp(user);
    await fillSignUp(user);

    await waitFor(() =>
      expect(auth.signUpWithEmail).toHaveBeenCalledWith('runner@maway.app', 'secret123'),
    );
  });

  it('shows the cap message when sign-up is closed', async () => {
    const user = userEvent.setup();
    auth.signUpWithEmail.mockResolvedValue({ ok: false, code: 'cap' });
    await goToSignUp(user);
    await fillSignUp(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(t('login.err.cap'));
  });

  it('shows the check-your-inbox state when confirmation is required', async () => {
    const user = userEvent.setup();
    auth.signUpWithEmail.mockResolvedValue({ ok: true, needsConfirm: true });
    await goToSignUp(user);
    await fillSignUp(user);

    expect(
      await screen.findByRole('heading', { name: t('login.checkMailTitle') }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(t('login.checkMailSub', { email: 'runner@maway.app' })),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(t('login.emailLabel'))).not.toBeInTheDocument();
  });
});


describe('LoginScreen — guest mode', () => {
  const guestBtn = () => screen.getByRole('button', { name: t('login.continueAsGuest') });

  it('offers a way past the gate without an account', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(guestBtn());

    expect(auth.continueAsGuest).toHaveBeenCalledTimes(1);
    expect(auth.dismissLogin).not.toHaveBeenCalled();
  });

  it('just closes again for someone already in guest mode', async () => {
    // Reopened from Settings — choosing guest a second time would be a no-op,
    // so the same control has to dismiss instead of re-entering guest mode.
    const user = userEvent.setup();
    auth.guest = true;
    renderLogin();

    await user.click(guestBtn());

    expect(auth.dismissLogin).toHaveBeenCalledTimes(1);
    expect(auth.continueAsGuest).not.toHaveBeenCalled();
  });

  it('stays available in sign-up mode too', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: t('login.signUp') }));

    expect(guestBtn()).toBeInTheDocument();
  });
});
