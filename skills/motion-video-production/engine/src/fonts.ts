import { continueRender, delayRender } from 'remotion';
import pretendard from 'pretendard/dist/web/variable/woff2/PretendardVariable.woff2';

// Fonts come from pinned npm packages (pretendard 1.3.9, SIL OFL 1.1), never system fonts: the headless shell may
// lack them. The bundler serves the imported file as an asset. Every frame waits until the face is loaded, so frame 0
// never renders with a fallback font.
const faces = [new FontFace('Pretendard', `url(${pretendard})`, { weight: '45 920' })];
const handle = delayRender('fonts');
Promise.all(faces.map((f) => f.load())).then((loaded) => {
  loaded.forEach((f) => document.fonts.add(f));
  continueRender(handle);
});

export const FONT = { sans: 'Pretendard, sans-serif' };
