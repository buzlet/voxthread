<!-- docs/development.md -->
# Development targets

## Android targets

### Galaxy A57
Primary real-device target.

Purpose:
- Samsung/Android behaviour.
- Real phone calls, audio focus, screen lock and Doze.
- Real Telegram Web session and Android TTS integration.
- Final background/lock-screen validation.

Transport:
- Wireless ADB from `u24`.
- Edge Android + Tampermonkey + CDP.

### Android Emulator
Secondary fast development target.

Purpose:
- Rapid userscript/browser regression testing.
- DOM, queue, controls and browser lifecycle experiments.
- Reproducible clean Android state.
- Must not replace Galaxy A57 for Samsung, telephony, audio-focus,
  power-management or real lock-screen acceptance tests.

Current host blocker:
- `u24` runs as a Microsoft Hyper-V guest.
- `/dev/kvm` is absent.
- Guest CPU does not expose `vmx`/`svm`.
- `modprobe kvm_intel` fails with `Operation not supported`.
- Hyper-V nested virtualization must be enabled on the host before
  accelerated Android Emulator is practical inside `u24`.
