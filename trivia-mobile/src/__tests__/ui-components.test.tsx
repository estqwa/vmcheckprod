import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { BrandHeader } from '../components/ui/BrandHeader';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { OfflineBanner } from '../components/ui/OfflineBanner';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

jest.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: jest.fn(),
}));

describe('UI component snapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNetworkStatus as jest.Mock).mockReturnValue({
      isOffline: false,
      isOnline: true,
      isConnected: true,
      isInternetReachable: true,
    });
  });

  it('matches snapshot for PrimaryButton', () => {
    let json: unknown = null;
    act(() => {
      json = renderer.create(<PrimaryButton title="Submit" onPress={jest.fn()} />).toJSON();
    });
    const tree = json;
    expect(tree).toMatchSnapshot();
  });

  it('matches snapshot for BrandHeader with back button and slot', () => {
    let json: unknown = null;
    act(() => {
      json = renderer
        .create(
          <BrandHeader
            title="QazaQuiz"
            subtitle="Trivia"
            onBackPress={jest.fn()}
            rightSlot={<Text>Right Slot</Text>}
          />,
        )
        .toJSON();
    });
    const tree = json;
    expect(tree).toMatchSnapshot();
  });

  it('matches snapshot for OfflineBanner when offline', () => {
    (useNetworkStatus as jest.Mock).mockReturnValue({
      isOffline: true,
      isOnline: false,
      isConnected: false,
      isInternetReachable: false,
    });

    let json: unknown = null;
    act(() => {
      json = renderer.create(<OfflineBanner />).toJSON();
    });
    const tree = json;
    expect(tree).toMatchSnapshot();
  });
});
