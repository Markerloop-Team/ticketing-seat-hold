/**
 * Editorial copy for the demo, the part a CMS would own. It is kept out of the
 * ticketing API on purpose: the API contract stays about seats, holds and tickets.
 */

export interface Credit {
  role: string;
  name: string;
}

export interface Programme {
  company: string;
  genre: string;
  tagline: string;
  description: string;
  duration: string;
  age: string;
  credits: Credit[];
}

export const programmes: Record<string, Programme> = {
  "swan-lake": {
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
  },
};

export interface SeasonItem {
  title: string;
  genre: string;
  date: string;
  hue: number;
}

/** The rest of the season, shown for context; only Swan Lake is on sale in the demo. */
export const season: SeasonItem[] = [
  { title: "La Traviata", genre: "Opera · Verdi", date: "From 4 Dec", hue: 350 },
  { title: "The Nutcracker", genre: "Ballet · Tchaikovsky", date: "From 21 Dec", hue: 150 },
  { title: "Carmen", genre: "Opera · Bizet", date: "From 15 Jan", hue: 20 },
];
