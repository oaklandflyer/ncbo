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

/** The default rest between sets. 90 seconds is the usual accessory default. */
export const REST_SECONDS = 90;

const EMPTY = {
  isActive: false,
  startTime: null,
  sessionId: null,
  exercises: [],
  /* An absolute end time, not a remaining count. A countdown stored as
     "62 seconds left" is wrong the moment the tab is backgrounded, because
     nothing decrements it while the phone is asleep. An end timestamp is
     still correct when the screen comes back on. */
  restEndsAt: null,
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
         screen can tick `completed` without restating weight and reps.
         
         Ticking a set starts the rest timer, and that lives here rather than
         in the screen so it cannot be forgotten by whichever component next
         renders a set row. Only on the transition to ticked: correcting the
         weight on an already-finished set is not the start of a rest. */
      updateSet: (exerciseIndex, setIndex, patch) => set((s) => {
        const was = s.exercises[exerciseIndex]?.sets?.[setIndex]?.completed === true;
        const nowTicked = patch?.completed === true && !was;
        return {
          exercises: applySetUpdate(s.exercises, exerciseIndex, setIndex, patch),
          restEndsAt: nowTicked ? Date.now() + REST_SECONDS * 1000 : s.restEndsAt,
        };
      }),

      /** Start, restart, or dismiss the rest clock by hand. */
      startRest: (seconds = REST_SECONDS) => set({ restEndsAt: Date.now() + seconds * 1000 }),
      clearRest: () => set({ restEndsAt: null }),

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
        /* Persisted deliberately. Reloading mid-rest should resume the same
           countdown, and an absolute end time is still true after a reload
           where a remaining-seconds value would not be. */
        restEndsAt: s.restEndsAt,
      }),
      onRehydrateStorage: () => (state) => state?.setHasHydrated(true),
    },
  ),
);
