import React from 'react';
import renderer, { act } from 'react-test-renderer';
import * as ExpoRouter from 'expo-router';
import RegisterScreen from '../../app/(auth)/register';
import { useAuth } from '../providers/AuthProvider';
import { useGoogleCodeAuthRequest } from '../hooks/useGoogleCodeAuthRequest';

jest.mock('@react-native-community/datetimepicker', () => {
  const DateTimePicker = (props: any) => null;
  return DateTimePicker;
});

jest.mock('../providers/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../hooks/useGoogleCodeAuthRequest', () => ({
  useGoogleCodeAuthRequest: jest.fn(),
}));

type TestTree = ReturnType<typeof renderer.create>;

type TestRoot = TestTree['root'];

describe('RegisterScreen', () => {
  const router = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  const register = jest.fn();
  const clearError = jest.fn();
  const loginWithGoogle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (ExpoRouter.useRouter as jest.Mock).mockReturnValue(router);
    (useAuth as jest.Mock).mockReturnValue({
      register,
      loginWithGoogle,
      error: null,
      clearError,
      isLoading: false,
    });
    (useGoogleCodeAuthRequest as jest.Mock).mockReturnValue({
      enabled: false,
      request: null,
      response: null,
      promptAsync: jest.fn(),
      redirectUri: 'qazaquiz://auth',
      platform: 'mobile',
    });
    register.mockResolvedValue(undefined);
  });

  function getMockDateTimePicker() {
    return jest.requireMock('@react-native-community/datetimepicker') as any;
  }

  function getTextInput(root: TestRoot, label: string) {
    const node = root.findAll(
      (instance: any) =>
        instance.props?.accessibilityLabel === label && typeof instance.props?.onChangeText === 'function',
    )[0];

    if (!node) {
      throw new Error(`TextInput with accessibilityLabel "${label}" not found`);
    }

    return node;
  }

  function getPressable(root: TestRoot, label: string) {
    const node = root.findAll(
      (instance: any) =>
        instance.props?.accessibilityLabel === label && typeof instance.props?.onPress === 'function',
    )[0];

    if (!node) {
      throw new Error(`Pressable with accessibilityLabel "${label}" not found`);
    }

    return node;
  }

  function hasText(root: TestRoot, value: string) {
    return root.findAll((instance: any) => instance.type === 'Text' && instance.children?.includes(value)).length > 0;
  }

  function fillRequiredFields(root: TestRoot) {
    act(() => {
      getTextInput(root, 'auth.firstName').props.onChangeText('Ada');
      getTextInput(root, 'auth.lastName').props.onChangeText('Lovelace');
      getTextInput(root, 'auth.username').props.onChangeText('ada');
      getTextInput(root, 'auth.email').props.onChangeText('ada@example.com');
      getTextInput(root, 'auth.password').props.onChangeText('secret1');
      getTextInput(root, 'auth.confirmPassword').props.onChangeText('secret1');
    });

    act(() => {
      getPressable(root, 'auth.birthDate').props.onPress();
    });

    const datePicker = root.findByType(getMockDateTimePicker());
    act(() => {
      datePicker.props.onChange({}, new Date(2000, 0, 2));
    });

    act(() => {
      getPressable(root, 'auth.genderFemale').props.onPress();
    });
  }

  it('requires consent cards before submitting', async () => {
    let tree: TestTree | undefined;

    await act(async () => {
      tree = renderer.create(<RegisterScreen />);
    });

    const root = tree!.root;
    fillRequiredFields(root);

    await act(async () => {
      getPressable(root, 'auth.registerButton').props.onPress();
    });

    expect(register).not.toHaveBeenCalled();
    expect(hasText(root, 'auth.acceptTerms')).toBe(true);

    await act(async () => {
      tree!.unmount();
    });
  });

  it('submits successfully after consent cards are checked', async () => {
    let tree: TestTree | undefined;

    await act(async () => {
      tree = renderer.create(<RegisterScreen />);
    });

    const root = tree!.root;
    fillRequiredFields(root);

    act(() => {
      getPressable(root, 'auth.acceptTos').props.onPress();
      getPressable(root, 'auth.acceptPrivacy').props.onPress();
    });

    await act(async () => {
      await getPressable(root, 'auth.registerButton').props.onPress();
    });

    expect(register).toHaveBeenCalledWith({
      username: 'ada',
      email: 'ada@example.com',
      password: 'secret1',
      first_name: 'Ada',
      last_name: 'Lovelace',
      birth_date: '2000-01-02',
      gender: 'female',
      tos_accepted: true,
      privacy_accepted: true,
      tos_version: expect.any(String),
      privacy_version: expect.any(String),
    });
    expect(router.replace).toHaveBeenCalledWith('/(auth)/verify-email');

    await act(async () => {
      tree!.unmount();
    });
  });

  it('ignores duplicate submit presses while registration is pending', async () => {
    let tree: TestTree | undefined;
    let resolveRegister: (() => void) | undefined;
    register.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRegister = resolve;
        }),
    );

    await act(async () => {
      tree = renderer.create(<RegisterScreen />);
    });

    const root = tree!.root;
    fillRequiredFields(root);

    act(() => {
      getPressable(root, 'auth.acceptTos').props.onPress();
      getPressable(root, 'auth.acceptPrivacy').props.onPress();
    });

    let firstSubmit: Promise<void> | undefined;
    let secondSubmit: Promise<void> | undefined;

    await act(async () => {
      firstSubmit = getPressable(root, 'auth.registerButton').props.onPress();
      secondSubmit = getPressable(root, 'auth.registerButton').props.onPress();
      expect(register).toHaveBeenCalledTimes(1);
      resolveRegister?.();
      await Promise.all([firstSubmit, secondSubmit]);
    });

    expect(register).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree!.unmount();
    });
  });
});

