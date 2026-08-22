'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  newExercise, applySetUpdate, appendSet, removeSet, completedOnly, workoutTotals,
} from '@/lib/workout';

/**
 * The live workout, kept in the browser.
 *
 * Persisted to localStorage, and that is the entire reason this is a store
 * rather than component state. Somebody logging a workout is on a phone, in a
 * gym, with the screen locking between sets and the browser free to discard a
 * backgrounded tab whenever it likes. Losing an hour of sets to a reload is
 * the one failure this feature cannot have.
 *
 * The document shape matches `workout_sessions.workout_data` exactly, so
 * finishing a workout is one insert of what is already here, with no mapping
 * layer that could disagree.
 *
 * All the editing logic lives in `@/lib/workout` as pure functions. This file
 * is the React binding and the persistence, and holds no rules of its own.
 */

const STORAGE_KEY = 'ncbo.workout.v1';

const EMPTY = {
  isActive: false,
  startTime: null,
  sessionId: null,
  exercises: [],
};

export const useWorkoutStore = create()(
  persist(
    (set, get) => ({
      ...EMPTY,

      /* Set on rehydration, and the reason is SSR. The server renders with an
         empty store and the browser rehydrates from localStorage, so anything
         that renders differently between the two is a hydration mismatch. A
         screen reading this can hold still until the real answer arrives. */
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      startWorkout: () => {
        /* Starting over an active workout would silently discard it. The
           caller decides; this refuses. */
        if (get().isActive) return false;
        set({
          isActive: true,
          startTime: new Date().toISOString(),
          sessionId: null,
          exercises: [],
        });
        return true;
      },

      addExercise: (exercise) => set((s) => ({
        exercises: [...s.exercises, newExercise(exercise)],
      })),

      removeExercise: (exerciseIndex) => set((s) => ({
        exercises: s.exercises.filter((_, i) => i !== exerciseIndex),
      })),

      /* `updateSet(exerciseIndex, setIndex, patch)`. A partial patch, so a
         screen can tick `completed` without restating weight and reps. */
      updateSet: (exerciseIndex, setIndex, patch) => set((s) => ({
        exercises: applySetUpdate(s.exercises, exerciseIndex, setIndex, patch),
      })),

      addSet: (exerciseIndex) => set((s) => ({
        exercises: appendSet(s.exercises, exerciseIndex),
      })),

      removeSet: (exerciseIndex, setIndex) => set((s) => ({
        exercises: removeSet(s.exercises, exerciseIndex, setIndex),
      })),

      /**
       * End the workout and hand back what is worth saving.
       *
       * It returns the payload rather than writing it: persistence is the
       * caller's job, and a store that talks to Supabase is a store that
       * cannot be tested without one. Phase 1 has no writer yet, so this is
       * the seam that one plugs into.
       */
      finishWorkout: () => {
        const { isActive, startTime, exercises } = get();
        if (!isActive) return null;

        const payload = {
          start_time: startTime,
          end_time: new Date().toISOString(),
          status: 'completed',
          workout_data: completedOnly(exercises),
        };
        set({ ...EMPTY });
        return payload;
      },

      /** Walk away without saving. Separate from finishing, and named so. */
      discardWorkout: () => set({ ...EMPTY }),

      totals: () => workoutTotals(get().exercises),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      /* `hasHydrated` is about this page load, not about the workout, so it
         must not be written to storage and read back as stale truth. */
      partialize: (s) => ({
        isActive: s.isActive,
        startTime: s.startTime,
        sessionId: s.sessionId,
        exercises: s.exercises,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
