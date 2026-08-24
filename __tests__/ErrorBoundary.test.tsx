/**
 * @format
 *
 * The boundary exists to turn a fatal JS-thread exception into a screen the
 * user can recover from, so both halves of that are asserted here: the crash
 * is reported, and pressing "Try again" remounts the subtree.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import ErrorBoundary from '../src/components/common/ErrorBoundary';

jest.mock('../src/services/crashReporting', () => ({
  recordError: jest.fn(),
  logBreadcrumb: jest.fn(),
}));

const { recordError } = require('../src/services/crashReporting');

function Boom({ shouldThrow }: { shouldThrow: boolean }): React.JSX.Element {
  if (shouldThrow) throw new Error('kaboom');
  return <Text>ok</Text>;
}

// React logs the caught error to console.error; silence it so the suite output
// still reads as a pass.
let consoleError: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => consoleError.mockRestore());

function texts(tree: ReactTestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

test('renders children when nothing throws', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );
  });
  expect(texts(tree)).toContain('ok');
});

test('shows the fallback and reports the error when a child throws', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <ErrorBoundary context="testRegion">
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    );
  });

  expect(texts(tree)).toContain('Something went wrong');
  expect(recordError).toHaveBeenCalledTimes(1);
  expect(recordError.mock.calls[0][1]).toBe('testRegion');
});

test('"Try again" remounts the subtree', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <ErrorBoundary>
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    );
  });
  expect(texts(tree)).toContain('Something went wrong');

  // The child stops throwing — the same situation as a transient bad payload
  // that a refetch replaces.
  await ReactTestRenderer.act(() => {
    tree.update(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );
  });

  const retryButton = tree.root.findAll(
    n => typeof n.props.onPress === 'function' && n.type !== 'Text',
  )[0];
  await ReactTestRenderer.act(() => {
    retryButton.props.onPress();
  });

  expect(texts(tree)).toContain('ok');
});
