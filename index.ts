import fs from "fs";
import zlib from "zlib";

const hex_arg = process.argv.slice(2)[0];

async function main() {
  const data = await getBinary("./input/tactical_mode_templates.bin");

  if (!data) {
    throw new Error("Unable to find tactical_mode_templates.bin");
  }

  let template: TacticalModeTemplate | null = null;
  let templates: any[] = [];
  let ba = new ByteArray(data);
  let header = ba.readInt8();
  let wba: ByteArray | undefined = undefined;
  if (header != 84) {
    ba.position = 0;

    try {
      ba.uncompress();
    } catch (ioe) {
      throw new Error("error:" + ioe);
    }
    wba = new ByteArray(Buffer.allocUnsafe(ba.data.byteLength));
    header = ba.readInt8();
    wba.writeInt8(header);

    if (header != 84) {
      throw new Error("bad header");
    }
  }

  let version = ba.readInt8();
  wba?.writeInt8(version);
  let numTemplates = ba.readInt32BE();
  wba?.writeInt32BE(numTemplates);

  for (let i = 0; i < numTemplates; i++) {
    template = new TacticalModeTemplate();
    template.fromRaw(ba, wba);
    templates[template.id] = template;
  }
  templates.shift(); // remove the 1st null element, (template id start at 1)

  if (wba && ba.position !== wba.position) {
    throw new Error("Failed to rewrite the correct bin file");
  }

  // fs.writeFileSync("./template.json", JSON.stringify(templates, null, 2));

  if (wba) {
    wba.compress();
    fs.writeFileSync(
      `./output/tactical_mode_templates_${hex_arg ?? "copy"}.bin`,
      wba.data
    );
  }
  return templates;
}

class TacticalModeTemplate {
  id: number;

  backgroundColor: number;

  groundCells: TacticalModeCell[];

  lineOfSightCells: any[];

  constructor() {
    this.id = 0;
    this.backgroundColor = 0;
    this.groundCells = [];
    this.lineOfSightCells = [];
  }

  private RGBToHex(r: number, g: number, b: number): number {
    const cR: number = Math.round(r) << 16;
    const cG: number = Math.round(g) << 8;
    const cB: number = Math.round(b);
    return cR | cG | cB;
  }

  private hexToRGB(color: number): { r: number; g: number; b: number } {
    return { r: (color >> 16) & 255, g: (color >> 8) & 255, b: color & 255 };
  }

  private RGBoToInt({ r, g, b }: { r: number; g: number; b: number }): number {
    return -16777216 + int32UnsignedToSigned(this.RGBToHex(r, g, b));
  }

  private RGBtoInt(r: number, g: number, b: number): number {
    return -16777216 + int32UnsignedToSigned(this.RGBToHex(r, g, b));
  }

  public fromRaw(raw: ByteArray, wba?: ByteArray): void {
    let i: number = 0;
    let cell: TacticalModeCell | null = null;
    let numGroundCells: number = 0;
    let numLineOfSightCells: number = 0;
    try {
      this.id = raw.readInt16BE();
      wba?.writeInt16BE(this.id);

      this.backgroundColor = raw.readInt32BE();
      let color = this.RGBoToInt(
        hex_to_RGB(hex_arg) ?? { r: 0, g: 177, b: 64 }
      ); // set the args colors, green by default
      wba?.writeInt32BE(color);

      numGroundCells = raw.readInt8();
      wba?.writeInt8(numGroundCells);

      this.groundCells = [];
      for (i = 0; i < numGroundCells; i++) {
        cell = new TacticalModeCell();
        cell.fromRaw(raw, 11, wba);

        this.groundCells.push(cell);
      }

      numLineOfSightCells = raw.readInt8();
      wba?.writeInt8(numLineOfSightCells);

      this.lineOfSightCells = []; // new Vector.<TacticalModeCell>(0);
      for (i = 0; i < numLineOfSightCells; i++) {
        cell = new TacticalModeCell();
        cell.fromRaw(raw, 11, wba);
        this.lineOfSightCells.push(cell);
      }
    } catch (e: any) {
      throw e;
    }
  }
}

class TacticalModeCell {
  elements: BasicElement[];
  elementsCount: number;
  constructor() {
    this.elements = [];
    this.elementsCount = 0;
  }
  public fromRaw(raw: ByteArray, mapVersion: number, wba?: ByteArray): void {
    let ge: GraphicalElement | null = null;
    this.elementsCount = raw.readInt16BE();
    wba?.writeInt16BE(this.elementsCount);
    //  this.elements = new Vector.<BasicElement>(elementsCount,true);
    this.elements = [];

    for (var i: number = 0; i < this.elementsCount; i++) {
      ge = new GraphicalElement(); // new GraphicalElement(this);
      ge.subFromRaw(raw, mapVersion, wba);
      this.elements[i] = ge;
    }
  }
}

class BasicElement {
  ID: number;
  name: String;
  strata: number;
  size: number;
  minSize: number;
  maxSize: number;
  anchors: any[];
  event: any[];
  properties: any[];
  className: String;
  cachedWidth: number;
  cachedHeight: number;
  cachedX: number;
  cachedY: number;
  constructor() {
    this.ID = 10000;
    this.name = "";
    this.strata = 1;
    this.size = 0;
    this.minSize = 0;
    this.maxSize = 0;
    this.anchors = [];
    this.event = [];
    this.properties = [];
    this.className = "";
    this.cachedWidth = 2147483647;
    this.cachedHeight = 2147483647;
    this.cachedX = 2147483647;
    this.cachedY = 2147483647;
  }
}

class GraphicalElement extends BasicElement {
  elementId: number;
  finalTeint: any;
  pixelOffset: { x: number; y: number };
  altitude: number;
  identifier: number;
  constructor() {
    super();
    this.elementId = 0;
    this.finalTeint = 0;
    this.pixelOffset = { x: 0, y: 0 };
    this.altitude = 0;
    this.identifier = 0;
  }
  subFromRaw(raw: ByteArray, mapVersion: number, wba?: ByteArray): void {
    this.elementId = raw.readUInt32BE();
    wba?.writeUInt32BE(this.elementId);
    this.calculateFinalTeint(
      raw.readInt8(),
      raw.readInt8(),
      raw.readInt8(),
      raw.readInt8(),
      raw.readInt8(),
      raw.readInt8(),
      wba
    );

    this.pixelOffset = { x: 0, y: 0 };
    if (mapVersion <= 4) {
      this.pixelOffset.x = raw.readInt8();
      wba?.writeInt8(this.pixelOffset.x);
      this.pixelOffset.x *= 43;

      this.pixelOffset.y = raw.readInt8();
      wba?.writeInt8(this.pixelOffset.y);
      this.pixelOffset.y *= 43;
    } else {
      this.pixelOffset.x = raw.readInt16BE();
      wba?.writeInt16BE(this.pixelOffset.x);
      this.pixelOffset.y = raw.readInt16BE();
      wba?.writeInt16BE(this.pixelOffset.y);
    }

    this.altitude = raw.readInt8();
    wba?.writeInt8(this.altitude);
  }

  private clamp(value: number, min: number, max: number): number {
    if (value > max) {
      return max;
    }
    if (value < min) {
      return min;
    }
    return value;
  }

  calculateFinalTeint(
    rHue: number,
    gHue: number,
    bHue: number,
    rShadow: number,
    gShadow: number,
    bShadow: number,
    wba?: ByteArray
  ): void {
    wba?.writeInt8(rHue);
    wba?.writeInt8(gHue);
    wba?.writeInt8(bHue);
    wba?.writeInt8(rShadow);
    wba?.writeInt8(gShadow);
    wba?.writeInt8(bShadow);

    let r: number = this.clamp((rHue + rShadow + 128) * 2, 0, 512);
    let g: number = this.clamp((gHue + gShadow + 128) * 2, 0, 512);
    let b: number = this.clamp((bHue + bShadow + 128) * 2, 0, 512);
    // this.finalTeint = new ColorMultiplicator(r, g, b, true);
    this.finalTeint = { r, g, b };
  }
}

class ByteArray {
  data: Buffer;
  position: number;
  constructor(data: Buffer) {
    this.data = data;
    this.position = 0;
  }

  get bytesAvailable() {
    return this.data.length - this.position;
  }

  readInt8() {
    const v = this.data.readInt8(this.position);
    this.position += 8 / 8;
    return v;
  }

  writeInt8(value: number) {
    this.data.writeInt8(value, this.position);
    this.position += 8 / 8;
  }

  readInt32BE() {
    const v = this.data.readInt32BE(this.position);
    this.position += 32 / 8;
    return v;
  }

  writeInt32BE(value: number) {
    this.data.writeInt32BE(value, this.position);
    this.position += 32 / 8;
  }

  readUInt32BE() {
    const v = this.data.readUInt32BE(this.position);
    this.position += 32 / 8;
    return v;
  }

  writeUInt32BE(value: number) {
    this.data.writeUInt32BE(value, this.position);
    this.position += 32 / 8;
  }

  readInt16BE() {
    const v = this.data.readInt16BE(this.position);
    this.position += 16 / 8;
    return v;
  }

  writeInt16BE(value: number) {
    this.data.writeInt16BE(value, this.position);
    this.position += 16 / 8;
  }

  uncompress() {
    this.data = zlib.inflateSync(this.data, { level: 9 });
    this.position = 0;
  }

  compress() {
    this.data = zlib.deflateSync(this.data, { level: 9 });
    this.position = 0;
  }
}

const int32SignedToUnsigned = (int32: number) =>
  Uint32Array.from(Int32Array.of(int32))[0];
const int32UnsignedToSigned = (uint32: number) =>
  Int32Array.from(Uint32Array.of(uint32))[0];

async function getBinary(src: string) {
  return fs.readFileSync(src);
}

function hex_to_RGB(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;

  let m = hex.match(/^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (m && m.length)
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16),
    };

  return null;
}

main();
