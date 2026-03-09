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

jest.mock('@react-native-picker/picker', () => {
  const Picker = (props: any) => null;
  (Picker as any).Item = () => null;
  return { Picker };
});

jest.mock('../providers/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../hooks/useGoogleCodeAuthRequest', () => ({
  useGoogleCodeAuthRequest: jest.fn(),
}));

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

  function getMockPicker() {
    return (jest.requireMock('@react-native-picker/picker') as { Picker: any }).Picker;
  }

  function getTextInput(root: renderer.ReactTestInstance, label: string) {
    const node = root.findAll(
      (instance: any) =>
        instance.props?.accessibilityLabel === label && typeof instance.props?.onChangeText === 'function',
    )[0];

    if (!node) {
      throw new Error(`TextInput with accessibilityLabel "${label}" not found`);
    }

    return node;
  }

  function getPressable(root: renderer.ReactTestInstance, label: string) {
    const node = root.findAll(
      (instance: any) =>
        instance.props?.accessibilityLabel === label && typeof instance.props?.onPress === 'function',
    )[0];

    if (!node) {
      throw new Error(`Pressable with accessibilityLabel "${label}" not found`);
    }

    return node;
  }

  function hasText(root: renderer.ReactTestInstance, value: string) {
    return root.findAll((instance: any) => instance.type === 'Text' && instance.children?.includes(value)).length > 0;
  }

  function fillRequiredFields(root: renderer.ReactTestInstance) {
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

    const picker = root.findByType(getMockPicker());
    act(() => {
      picker.props.onValueChange('female');
    });
  }

  it('requires consent cards before submitting', async () => {
    let tree: renderer.ReactTestRenderer | undefined;

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
    let tree: renderer.ReactTestRenderer | undefined;

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
});
