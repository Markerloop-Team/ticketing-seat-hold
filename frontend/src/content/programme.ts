/**
 * Editorial copy for the demo, the part a CMS would own. It is kept out of the
 * ticketing API on purpose: the API contract stays about seats, holds and tickets.
 * The in-browser mock seeds its events from this list so dates and venues match.
 */

export interface Credit {
  role: string;
  name: string;
}

export type Category = "ballet" | "opera" | "drama" | "concert" | "standup";
export type VenueKey = "grand-hall" | "studio";

export type Motif =
  | "swan"
  | "nutcracker"
  | "balcony"
  | "camellia"
  | "fan"
  | "letter"
  | "jazz"
  | "mic";

export interface PosterArt {
  motif: Motif;
  /** Sky gradient, top to bottom. */
  sky: [string, string, string];
  /** Title split over lines when it is too long for one. */
  lines?: string[];
}

export interface Production {
  slug: string;
  title: string;
  category: Category;
  company: string;
  genre: string;
  tagline: string;
  description: string;
  duration: string;
  age: string;
  credits: Credit[];
  venue: VenueKey;
  /** Days from today and local curtain time; the demo keeps the season ahead of the visitor. */
  daysOut: number;
  curtain: [number, number];
  /** Share of the order paid back as bonus points. */
  cashback: number;
  /** Lowest ticket price, as the listing endpoint would return it. */
  fromPrice: number;
  /** Rank for the "Popular" sort: tickets sold in the last week. */
  popularity: number;
  poster: PosterArt;
}

export const categories: Array<{ id: Category; label: string }> = [
  { id: "ballet", label: "Ballet" },
  { id: "opera", label: "Opera" },
  { id: "drama", label: "Drama" },
  { id: "concert", label: "Concerts" },
  { id: "standup", label: "Stand-up" },
];

export const venues: Record<VenueKey, { name: string; short: string }> = {
  "grand-hall": { name: "Grand Hall, Meridian Opera House", short: "Grand Hall" },
  studio: { name: "Riverside Studio, Meridian Opera House", short: "Riverside Studio" },
};

export const productions: Production[] = [
  {
    slug: "swan-lake",
    title: "Swan Lake",
    category: "ballet",
    company: "Meridian Ballet",
    genre: "Ballet in four acts",
    tagline: "Tchaikovsky's masterpiece, lit by moonlight and told without a word.",
    description:
      "Prince Siegfried slips away from his own birthday celebrations and, at the edge of a moonlit lake, meets Odette, a princess bound by a sorcerer's spell to live as a swan by day. Meridian Ballet's new staging strips the story back to light, water and sixty dancers, with the full orchestra in the pit and a third act that ends the evening on its feet.",
    duration: "2 h 40 min, two intervals",
    age: "6+",
    credits: [
      { role: "Odette / Odile", name: "Amira Sultanova" },
      { role: "Prince Siegfried", name: "Daniel Reyes" },
      { role: "Von Rothbart", name: "Timur Askarov" },
      { role: "Choreography", name: "Elena Marchetti, after Petipa and Ivanov" },
      { role: "Conductor", name: "Jonas Lindqvist" },
      { role: "Set and lighting", name: "Clara Weiss" },
    ],
    venue: "grand-hall",
    daysOut: 14,
    curtain: [19, 0],
    cashback: 0.05,
    fromPrice: 5000,
    popularity: 96,
    poster: { motif: "swan", sky: ["#2a0c1a", "#5a1430", "#0f0a14"] },
  },
  {
    slug: "the-nutcracker",
    title: "The Nutcracker",
    category: "ballet",
    company: "Meridian Ballet",
    genre: "Ballet in two acts",
    tagline: "A winter's night, a toy soldier and snow falling on the stage.",
    description:
      "On Christmas Eve, Clara is given a wooden nutcracker. At midnight the toys come to life, the tree grows to the ceiling and a snowstorm carries her to the Land of Sweets. The family classic of the season, with a children's choir and the full Meridian orchestra.",
    duration: "2 h 10 min, one interval",
    age: "4+",
    credits: [
      { role: "Clara", name: "Sofia Kim" },
      { role: "The Nutcracker Prince", name: "Arman Bekov" },
      { role: "Drosselmeyer", name: "Lucas Moreau" },
      { role: "Choreography", name: "Elena Marchetti, after Ivanov" },
      { role: "Conductor", name: "Jonas Lindqvist" },
      { role: "Costumes", name: "Ines Aldana" },
    ],
    venue: "grand-hall",
    daysOut: 33,
    curtain: [18, 0],
    cashback: 0.05,
    fromPrice: 6000,
    popularity: 100,
    poster: { motif: "nutcracker", sky: ["#08201f", "#12463f", "#070b0d"], lines: ["The", "Nutcracker"] },
  },
  {
    slug: "romeo-and-juliet",
    title: "Romeo and Juliet",
    category: "ballet",
    company: "Meridian Ballet",
    genre: "Ballet in three acts · Prokofiev",
    tagline: "Two houses, one balcony and Prokofiev's thunder.",
    description:
      "Verona's feud plays out in sword fights and ballroom masks until two teenagers fall for each other across the divide. Prokofiev's score moves from the stamp of the Dance of the Knights to the quiet of the balcony pas de deux.",
    duration: "2 h 45 min, two intervals",
    age: "12+",
    credits: [
      { role: "Juliet", name: "Mira Haddad" },
      { role: "Romeo", name: "Daniel Reyes" },
      { role: "Tybalt", name: "Timur Askarov" },
      { role: "Choreography", name: "Paolo Ricci" },
      { role: "Conductor", name: "Aiko Tanaka" },
      { role: "Set", name: "Clara Weiss" },
    ],
    venue: "grand-hall",
    daysOut: 9,
    curtain: [19, 0],
    cashback: 0.07,
    fromPrice: 5500,
    popularity: 81,
    poster: { motif: "balcony", sky: ["#170d2b", "#3b1d5a", "#0b0912"], lines: ["Romeo", "and Juliet"] },
  },
  {
    slug: "la-traviata",
    title: "La Traviata",
    category: "opera",
    company: "Meridian Opera",
    genre: "Opera in three acts · Verdi",
    tagline: "Champagne, a camellia and a love Paris will not allow.",
    description:
      "Violetta, the brightest star of Paris salons, gives up everything for Alfredo, until his father asks her for one more sacrifice. Verdi's most performed opera, sung in Italian with English surtitles.",
    duration: "2 h 50 min, two intervals",
    age: "12+",
    credits: [
      { role: "Violetta", name: "Leila Nurmagambet" },
      { role: "Alfredo", name: "Marco Bellini" },
      { role: "Germont", name: "Henrik Dahl" },
      { role: "Director", name: "Anna Kowalska" },
      { role: "Conductor", name: "Aiko Tanaka" },
      { role: "Chorus master", name: "Ruslan Ospanov" },
    ],
    venue: "grand-hall",
    daysOut: 21,
    curtain: [19, 0],
    cashback: 0.05,
    fromPrice: 5000,
    popularity: 84,
    poster: { motif: "camellia", sky: ["#26090f", "#6b1022", "#0f0a0c"], lines: ["La", "Traviata"] },
  },
  {
    slug: "carmen",
    title: "Carmen",
    category: "opera",
    company: "Meridian Opera",
    genre: "Opera in four acts · Bizet",
    tagline: "Seville in summer heat. Nobody tells Carmen who to love.",
    description:
      "A soldier deserts for a cigarette-factory girl who will not belong to anyone. Bizet's Carmen is the opera people know without knowing it: the Habanera, the Toreador song and a final duet outside the bullring.",
    duration: "3 h, two intervals",
    age: "16+",
    credits: [
      { role: "Carmen", name: "Dana Abenova" },
      { role: "Don José", name: "Marco Bellini" },
      { role: "Escamillo", name: "Henrik Dahl" },
      { role: "Director", name: "Anna Kowalska" },
      { role: "Conductor", name: "Jonas Lindqvist" },
      { role: "Choreography", name: "Lucia Ortega" },
    ],
    venue: "grand-hall",
    daysOut: 47,
    curtain: [19, 0],
    cashback: 0.07,
    fromPrice: 5500,
    popularity: 90,
    poster: { motif: "fan", sky: ["#2b0d08", "#8a2412", "#120a08"] },
  },
  {
    slug: "the-inspector",
    title: "The Government Inspector",
    category: "drama",
    company: "Riverside Company",
    genre: "Comedy in five acts · Gogol",
    tagline: "A small town, a wrong guest and a letter that changes everything.",
    description:
      "Word reaches a provincial town that an inspector is travelling in disguise. The mayor and his officials mistake a broke young clerk for him and fall over each other to bribe him. Gogol's comedy, played in the round on the Riverside's thrust stage.",
    duration: "2 h 20 min, one interval",
    age: "14+",
    credits: [
      { role: "Khlestakov", name: "Oliver Brandt" },
      { role: "The Mayor", name: "Yerlan Kassym" },
      { role: "Anna", name: "Greta Sorensen" },
      { role: "Director", name: "Mikhail Orlov" },
      { role: "Set", name: "Hana Novak" },
    ],
    venue: "studio",
    daysOut: 6,
    curtain: [19, 0],
    cashback: 0.05,
    fromPrice: 3500,
    popularity: 68,
    poster: { motif: "letter", sky: ["#0d1a17", "#24453c", "#080c0b"], lines: ["The Government", "Inspector"] },
  },
  {
    slug: "midnight-jazz",
    title: "Midnight Jazz Quartet",
    category: "concert",
    company: "Riverside Sessions",
    genre: "Concert · jazz",
    tagline: "Piano, bass, drums and sax, three metres from your seat.",
    description:
      "The quartet plays the new album start to finish, then takes requests from the room. Tables at the front, raked seats behind, and a bar that stays open through the set.",
    duration: "1 h 45 min, no interval",
    age: "16+",
    credits: [
      { role: "Saxophone", name: "Marcus Bell" },
      { role: "Piano", name: "Aruzhan Tulegen" },
      { role: "Double bass", name: "Felix Wagner" },
      { role: "Drums", name: "Sam Okafor" },
    ],
    venue: "studio",
    daysOut: 4,
    curtain: [21, 0],
    cashback: 0.07,
    fromPrice: 3500,
    popularity: 73,
    poster: { motif: "jazz", sky: ["#071423", "#0f3550", "#05080d"], lines: ["Midnight", "Jazz Quartet"] },
  },
  {
    slug: "late-night-stand-up",
    title: "Late Night Stand-Up",
    category: "standup",
    company: "Riverside Comedy",
    genre: "Stand-up · four comedians",
    tagline: "Four comedians, one microphone, no rehearsals.",
    description:
      "The monthly showcase: four comedians try out new material in front of a full room. Expect a host who talks to the front row, one headliner and at least one joke that does not survive the night.",
    duration: "1 h 40 min, no interval",
    age: "18+",
    credits: [
      { role: "Host", name: "Dias Zhaksylyk" },
      { role: "Headliner", name: "Rachel Stone" },
      { role: "Support", name: "Tom Becker" },
      { role: "Support", name: "Aliya Sadykova" },
    ],
    venue: "studio",
    daysOut: 11,
    curtain: [20, 30],
    cashback: 0.1,
    fromPrice: 4200,
    popularity: 88,
    poster: { motif: "mic", sky: ["#1f0820", "#5e1450", "#0c0610"], lines: ["Late Night", "Stand-Up"] },
  },
];

export const bySlug: Record<string, Production> = Object.fromEntries(
  productions.map((p) => [p.slug, p]),
);

/** Productions in the hero carousel on the season page. */
export const featured = ["the-nutcracker", "swan-lake", "late-night-stand-up"];

/** Curtain-up time for a production, counted from `from` in local time. */
export function curtainUp(p: Production, from: number = Date.now()): string {
  const d = new Date(from + p.daysOut * 86_400_000);
  d.setHours(p.curtain[0], p.curtain[1], 0, 0);
  return d.toISOString();
}

export function showDate(iso: string) {
  const d = new Date(iso);
  return {
    short: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
    long: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  };
}
