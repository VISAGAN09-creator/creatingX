/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PanelId = 'front' | 'back' | 'leftSleeve' | 'rightSleeve' | 'extra';

export type DesignSizeType = 'small' | 'medium' | 'large';

export interface PanelDesign {
  url: string | null;
  name: string | null;
  x: number; // percentage from center/left (e.g. 50 is center)
  y: number; // percentage from center/top (e.g. 50 is center)
  sizeType: DesignSizeType;
  rotation: number; // degrees (0 to 360)
}

export type TShirtColor = 'white' | 'black' | 'red';

export type TShirtSize = 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface CustomizerState {
  color: TShirtColor;
  garmentSize: TShirtSize;
  activePanel: PanelId;
  designs: Record<PanelId, PanelDesign>;
  style: 'oversized' | 'polo';
  finish: 'normal' | 'acid wash';
}

export interface PresetDesign {
  id: string;
  name: string;
  url: string;
  category: string;
}
