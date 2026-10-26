import { describe, expect, it } from "vitest";
import { classifyInstrument, sectionForInstrumentName } from "@/shared/sections";
import { abbreviateInstrumentName } from "@/shared/score";

describe("sectionForInstrumentName", () => {
  it.each([
    ["Violin I", "Strings"],
    ["Viola", "Strings"],
    ["Violoncello", "Strings"],
    ["Double Bass", "Strings"],
    ["Contrabass", "Strings"],
    ["Bass", "Strings"],
    ["Flute", "Woodwinds"],
    ["Bass Clarinet", "Woodwinds"],
    ["Contrabassoon", "Woodwinds"],
    ["English Horn", "Woodwinds"],
    ["Alto Sax", "Woodwinds"],
    ["Horn in F", "Brass"],
    ["Bass Trombone", "Brass"],
    ["Tuba", "Brass"],
    ["Timpani", "Percussion"],
    ["Bass Drum", "Percussion"],
    ["Tubular Bells", "Percussion"],
    ["Harp", "Other"],
    ["Piano", "Other"],
    ["Fagott", "Woodwinds"],
    ["Corni", "Brass"],
    ["Contrabbasso", "Strings"],
  ] as const)("%s → %s", (name, section) => {
    expect(sectionForInstrumentName(name)).toBe(section);
  });
});

describe("classifyInstrument", () => {
  it("prefers the instrument-sound id", () => {
    expect(classifyInstrument({ name: "Part 1", instrumentSound: "strings.violin" })).toBe("Strings");
    expect(classifyInstrument({ name: "Part 1", instrumentSound: "wind.flutes.flute" })).toBe("Woodwinds");
    expect(classifyInstrument({ name: "Part 1", instrumentSound: "brass.trumpet" })).toBe("Brass");
    expect(classifyInstrument({ name: "Part 1", instrumentSound: "drum.timpani" })).toBe("Percussion");
    expect(classifyInstrument({ name: "Part 1", instrumentSound: "pluck.harp" })).toBe("Other");
    expect(classifyInstrument({ name: "Violin", instrumentSound: "keyboard.piano" })).toBe("Other");
  });

  it("then the name, MIDI channel 10, the GM program family, and the abbreviation", () => {
    expect(classifyInstrument({ name: "Cello", midiProgram: 1 })).toBe("Strings");
    expect(classifyInstrument({ name: "Kit", midiChannel: 10, midiProgram: 1 })).toBe("Percussion");
    expect(classifyInstrument({ name: "Line", midiProgram: 34 })).toBe("Strings"); // bass family
    expect(classifyInstrument({ name: "Line", midiProgram: 41 })).toBe("Strings");
    expect(classifyInstrument({ name: "Line", midiProgram: 47 })).toBe("Other"); // harp
    expect(classifyInstrument({ name: "Line", midiProgram: 48 })).toBe("Percussion"); // timpani
    expect(classifyInstrument({ name: "Line", midiProgram: 50 })).toBe("Strings"); // string ensemble
    expect(classifyInstrument({ name: "Line", midiProgram: 61 })).toBe("Brass");
    expect(classifyInstrument({ name: "Line", midiProgram: 69 })).toBe("Woodwinds");
    expect(classifyInstrument({ name: "Line", midiProgram: 74 })).toBe("Woodwinds");
    expect(classifyInstrument({ name: "Line", midiProgram: 117 })).toBe("Percussion");
    expect(classifyInstrument({ name: "Line", midiProgram: 26 })).toBe("Other"); // guitar
    expect(classifyInstrument({ name: "Line", abbreviation: "Vla." })).toBe("Other"); // "Vla." is not a keyword
    expect(classifyInstrument({ name: "Line", abbreviation: "Tuba 2" })).toBe("Brass");
    expect(classifyInstrument({ name: "Line" })).toBe("Other");
  });
});

describe("abbreviateInstrumentName", () => {
  it.each([
    ["Violin I", "Vln. I"],
    ["Violin II", "Vln. II"],
    ["Violin 1", "Vln. I"],
    ["Viola", "Vla."],
    ["Cello", "Vc."],
    ["Violoncello", "Vc."],
    ["Double Bass", "Cb."],
    ["Contrabass", "Cb."],
    ["Flute", "Fl."],
    ["Flute 2", "Fl. 2"],
    ["Clarinet in B♭", "Cl."],
    ["Bass Clarinet", "B. Cl."],
    ["Bassoon", "Bsn."],
    ["Horn in F", "Hn."],
    ["Horn III", "Hn. III"],
    ["Trumpet in C", "Tpt."],
    ["Bass Trombone", "B. Tbn."],
    ["Timpani", "Timp."],
    ["Harp", "Hp."],
    ["Kit", "Kit"],
    ["Ondes Martenot", "Onde."],
  ])("%s → %s", (name, abbr) => {
    expect(abbreviateInstrumentName(name)).toBe(abbr);
  });
});
