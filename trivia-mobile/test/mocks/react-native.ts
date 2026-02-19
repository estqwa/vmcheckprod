import React from 'react';

type BasicProps = Record<string, unknown> & { children?: React.ReactNode };
type FlatListProps<T> = BasicProps & {
  data?: T[];
  renderItem?: (info: { item: T; index: number }) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
};

function createComponent(name: string) {
  return function Component({ children, ...props }: BasicProps) {
    return React.createElement(name, props, children);
  };
}

export const View = createComponent('View');
export const Text = createComponent('Text');
export const ScrollView = createComponent('ScrollView');
export const TouchableOpacity = createComponent('TouchableOpacity');
export const Pressable = createComponent('Pressable');
export const TextInput = createComponent('TextInput');
export const FlatList = function FlatList<T>({
  data = [],
  renderItem,
  keyExtractor,
  ...props
}: FlatListProps<T>) {
  const rendered = renderItem
    ? data.map((item, index) =>
      React.createElement(
        React.Fragment,
        { key: keyExtractor ? keyExtractor(item, index) : String(index) },
        renderItem({ item, index }),
      ),
    )
    : null;

  return React.createElement('FlatList', props, rendered);
};
export const KeyboardAvoidingView = createComponent('KeyboardAvoidingView');
export const ActivityIndicator = createComponent('ActivityIndicator');
export const RefreshControl = createComponent('RefreshControl');

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
};

export const Platform = {
  OS: 'ios',
};

type AppStateStatus = 'active' | 'background' | 'inactive';

const listeners = new Set<(state: AppStateStatus) => void>();

export const AppState = {
  currentState: 'active' as AppStateStatus,
  addEventListener: (_event: 'change', listener: (state: AppStateStatus) => void) => {
    listeners.add(listener);
    return {
      remove: () => {
        listeners.delete(listener);
      },
    };
  },
  __emit: (state: AppStateStatus) => {
    AppState.currentState = state;
    listeners.forEach((listener) => listener(state));
  },
};

export const useColorScheme = () => 'light';
