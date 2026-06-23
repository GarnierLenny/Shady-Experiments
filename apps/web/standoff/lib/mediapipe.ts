/**
 * Lazy, cached loaders for MediaPipe Tasks Vision models. Everything is
 * dynamically imported so the heavy WASM only loads in the browser, on demand.
 */
import type {
  FaceLandmarker as FaceLandmarkerType,
  HandLandmarker as HandLandmarkerType,
  PoseLandmarker as PoseLandmarkerType,
} from '@mediapipe/tasks-vision';

const WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const HAND_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let filesetPromise: Promise<unknown> | null = null;
let handPromise: Promise<HandLandmarkerType> | null = null;
const faceInstances = new Map<string, Promise<FaceLandmarkerType>>();
const poseInstances = new Map<string, Promise<PoseLandmarkerType>>();

/**
 * MediaPipe's WASM prints benign TFLite / XNNPACK / GL "INFO:" lines through
 * console.error, which trips the Next.js dev error overlay. Filter only those
 * specific lines; everything else passes through untouched.
 */
function quietMediapipeLogs() {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __sdQuietMp?: boolean };
  if (w.__sdQuietMp) return;
  w.__sdQuietMp = true;
  const NOISE =
    /XNNPACK|TensorFlow Lite|TfLite|Created TensorFlow|GL version|gl_context|OpenGL|feedback manager/i;
  const wrap =
    (orig: (...a: unknown[]) => void) =>
    (...args: unknown[]) => {
      const msg = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');
      if (NOISE.test(msg)) return;
      orig(...args);
    };
  console.error = wrap(console.error.bind(console));
  console.warn = wrap(console.warn.bind(console));
  console.info = wrap(console.info.bind(console));
}

async function getFileset() {
  quietMediapipeLogs();
  const { FilesetResolver } = await import('@mediapipe/tasks-vision');
  if (!filesetPromise) filesetPromise = FilesetResolver.forVisionTasks(WASM_BASE);
  return filesetPromise as ReturnType<typeof FilesetResolver.forVisionTasks>;
}

export function loadHandLandmarker(): Promise<HandLandmarkerType> {
  if (!handPromise) {
    handPromise = (async () => {
      const { HandLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await getFileset();
      const base = { modelAssetPath: HAND_MODEL };
      try {
        return await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { ...base, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 2,
        });
      } catch {
        return await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { ...base, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numHands: 2,
        });
      }
    })();
  }
  return handPromise;
}

/**
 * A FaceLandmarker can only follow one video stream, so callers pass a `key`
 * (e.g. "local" / "remote") to get a dedicated instance per camera.
 */
export function loadFaceLandmarker(key = 'default'): Promise<FaceLandmarkerType> {
  let instance = faceInstances.get(key);
  if (!instance) {
    instance = (async () => {
      const { FaceLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await getFileset();
      const base = { modelAssetPath: FACE_MODEL };
      try {
        return await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { ...base, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
      } catch {
        return await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { ...base, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
        });
      }
    })();
    faceInstances.set(key, instance);
  }
  return instance;
}

/**
 * Pose tracking locates the head (eye landmarks) robustly whether the player is
 * seated and close or standing back from the camera - unlike face mesh, which
 * loses small/distant faces. One instance per camera via `key`.
 */
export function loadPoseLandmarker(key = 'default'): Promise<PoseLandmarkerType> {
  let instance = poseInstances.get(key);
  if (!instance) {
    instance = (async () => {
      const { PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const fileset = await getFileset();
      const base = { modelAssetPath: POSE_MODEL };
      try {
        return await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { ...base, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
      } catch {
        return await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { ...base, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
      }
    })();
    poseInstances.set(key, instance);
  }
  return instance;
}
