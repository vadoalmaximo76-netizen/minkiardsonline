/**
 * useStoryWorldLogic — Reusable hook that owns the 3D open-world camera/control state.
 *
 * Extracts camera refs and mobile-control state from StoryWorldMap so these can be
 * composed independently (e.g. in tests or alternative renderers).
 *
 * Returns:
 *   - cameraYawRef      — written by PlayerCamera3D each frame; read by tick for
 *                         camera-relative movement (rotate dx/dz by yaw)
 *   - mobileCamRotateRef — read by PlayerCamera3D; when true, single-touch drag
 *                         rotates the camera instead of the player
 *   - camRotateMode     — React state mirror of mobileCamRotateRef for UI
 *   - toggleCamRotate   — stable callback to flip the cam-rotate mode
 */

import { useRef, useState, useCallback } from 'react';

export function useStoryWorldLogic() {
  /* Camera yaw shared between PlayerCamera3D (writer) and tick function (reader) */
  const cameraYawRef = useRef(0);

  /* Mobile cam-rotate mode: when true, single touch rotates camera not player */
  const mobileCamRotateRef = useRef(false);
  const [camRotateMode, setCamRotateMode] = useState(false);

  const toggleCamRotate = useCallback(() => {
    setCamRotateMode(prev => {
      const next = !prev;
      mobileCamRotateRef.current = next;
      return next;
    });
  }, []);

  return {
    cameraYawRef,
    mobileCamRotateRef,
    camRotateMode,
    toggleCamRotate,
  } as const;
}
