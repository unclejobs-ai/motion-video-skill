// Serif and mono faces for the word cut (Pretendard comes from src/fonts.ts). Pinned npm packages, SIL OFL 1.1:
// @fontsource/nanum-myeongjo 5.3.0 (Korean subsets) and @fontsource/jetbrains-mono 5.3.0. Never system fonts.
import '../../src/fonts.ts';
import '@fontsource/nanum-myeongjo/korean-400.css';
import '@fontsource/nanum-myeongjo/korean-700.css';
import '@fontsource/nanum-myeongjo/latin-400.css';
import '@fontsource/nanum-myeongjo/latin-700.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import { DATA } from './data.ts';

// The Korean face is split by unicode-range, so load exactly the characters the film shows.
const text = JSON.stringify(DATA).replaceAll('{w}', DATA.word);

/** resolves once every face (and Pretendard) can lay out the film's text */
export const fontsReady: Promise<void> = Promise.all([
  document.fonts.load('400 16px "Nanum Myeongjo"', text),
  document.fonts.load('700 16px "Nanum Myeongjo"', text),
  document.fonts.load('500 16px "JetBrains Mono"', text),
  document.fonts.load('700 16px "JetBrains Mono"', text),
  document.fonts.load('16px Pretendard', text),
]).then(() => document.fonts.ready).then(() => undefined);
