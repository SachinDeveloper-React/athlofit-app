import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useStepCoinEarnings } from '../useStepCoinEarnings';

// Mock stepService
const mockOnStepUpdate = jest.fn<() => void, [(steps: number) => void]>();
const mockGetCurrentSteps = jest.fn<Promise<number>, []>();

jest.mock('../../../../services/stepService', () => ({
  stepService: {
    onStepUpdate: (cb: (steps: number) => void) => {
      mockOnStepUpdate(cb);
      return jest.fn(); // unsubscribe
    },
    getCurrentSteps: () => mockGetCurrentSteps(),
  },
}));

// Mock useStepCoinRate
let mockRate = 0.00095;
jest.mock('../../../../store/appConfigStore', () => ({
  useStepCoinRate: () => mockRate,
}));

// Helper component to capture hook output
let hookResult: ReturnType<typeof useStepCoinEarnings>;

function TestComponent() {
  hookResult = useStepCoinEarnings();
  return null;
}

describe('useStepCoinEarnings', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockRate = 0.00095;
    mockOnStepUpdate.mockClear();
    mockGetCurrentSteps.mockResolvedValue(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function renderHook() {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        React.createElement(TestComponent),
      );
    });
    return renderer!;
  }

  describe('calculation with various step counts', () => {
    it('returns 0 earnings for 0 steps', () => {
      renderHook();
      expect(hookResult.earnings).toBe(0);
      expect(hookResult.steps).toBe(0);
    });

    it('returns 0 earnings for 99 steps (less than 100)', () => {
      renderHook();
      const stepCallback = mockOnStepUpdate.mock.calls[0][0];

      act(() => {
        stepCallback(99);
      });

      // floor(99/100) * 0.00095 = 0 * 0.00095 = 0
      expect(hookResult.earnings).toBe(0);
      expect(hookResult.steps).toBe(99);
    });

    it('returns correct earnings for exactly 100 steps', () => {
      renderHook();
      const stepCallback = mockOnStepUpdate.mock.calls[0][0];

      act(() => {
        stepCallback(100);
      });

      // Math.round(floor(100/100) * 0.00095) = Math.round(1 * 0.00095) = Math.round(0.00095) = 0
      expect(hookResult.earnings).toBe(0);
      expect(hookResult.steps).toBe(100);
    });

    it('returns correct earnings for 1000 steps', () => {
      renderHook();
      const stepCallback = mockOnStepUpdate.mock.calls[0][0];

      act(() => {
        stepCallback(1000);
      });

      // Math.round(floor(1000/100) * 0.00095) = Math.round(10 * 0.00095) = Math.round(0.0095) = 0
      expect(hookResult.earnings).toBe(0);
      expect(hookResult.steps).toBe(1000);
    });

    it('returns correct earnings for 10000 steps', () => {
      renderHook();
      const stepCallback = mockOnStepUpdate.mock.calls[0][0];

      act(() => {
        stepCallback(10000);
      });

      // Math.round(floor(10000/100) * 0.00095) = Math.round(100 * 0.00095) = Math.round(0.095) = 0
      expect(hookResult.earnings).toBe(0);
      expect(hookResult.steps).toBe(10000);
    });

    it('returns correct earnings with a higher rate', () => {
      mockRate = 1.0;
      renderHook();
      const stepCallback = mockOnStepUpdate.mock.calls[0][0];

      act(() => {
        stepCallback(10000);
      });

      // Math.round(floor(10000/100) * 1.0) = Math.round(100) = 100
      expect(hookResult.earnings).toBe(100);
      expect(hookResult.steps).toBe(10000);
    });

    it('returns correct earnings with moderate rate (0.5)', () => {
      mockRate = 0.5;
      renderHook();
      const stepCallback = mockOnStepUpdate.mock.calls[0][0];

      act(() => {
        stepCallback(10000);
      });

      // Math.round(floor(10000/100) * 0.5) = Math.round(100 * 0.5) = Math.round(50) = 50
      expect(hookResult.earnings).toBe(50);
      expect(hookResult.steps).toBe(10000);
    });
  });

  describe('rate changes are applied immediately', () => {
    it('recalculates earnings when rate changes', () => {
      mockRate = 0.5;
      const renderer = renderHook();
      const stepCallback = mockOnStepUpdate.mock.calls[0][0];

      act(() => {
        stepCallback(1000);
      });

      // floor(1000/100) * 0.5 = 10 * 0.5 = 5
      expect(hookResult.earnings).toBe(5);

      // Change rate and re-render
      mockRate = 1.0;
      act(() => {
        renderer.update(React.createElement(TestComponent));
      });

      // floor(1000/100) * 1.0 = 10 * 1.0 = 10
      expect(hookResult.earnings).toBe(10);
    });
  });

  describe('staleness detection after 30s', () => {
    it('is not stale immediately after a step update', () => {
      renderHook();
      const stepCallback = mockOnStepUpdate.mock.calls[0][0];

      act(() => {
        stepCallback(500);
      });

      expect(hookResult.isStale).toBe(false);
    });

    it('becomes stale when Date.now exceeds 30s from last calc', () => {
      const renderer = renderHook();
      const stepCallback = mockOnStepUpdate.mock.calls[0][0];

      act(() => {
        stepCallback(500);
      });
      expect(hookResult.isStale).toBe(false);

      // Mock Date.now to return a time 31s in the future
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now + 31_000);

      // Force a re-render to pick up the new Date.now value
      act(() => {
        renderer.update(React.createElement(TestComponent));
      });

      expect(hookResult.isStale).toBe(true);

      (Date.now as jest.Mock).mockRestore();
    });

    it('periodic timer refreshes steps every 30s', async () => {
      mockGetCurrentSteps.mockResolvedValue(2000);
      renderHook();

      // Advance timer by 30s to trigger the interval
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });

      expect(mockGetCurrentSteps).toHaveBeenCalled();
      expect(hookResult.steps).toBe(2000);
    });
  });
});
