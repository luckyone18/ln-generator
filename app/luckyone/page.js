import Gen4D from "./gen4d";

// Halaman RAHASIA — tidak di-link dari mana pun & noindex buat search engine.
export const metadata = {
  title: "G4D",
  robots: { index: false, follow: false },
};

export default function LuckyOnePage() {
  return <Gen4D />;
}
