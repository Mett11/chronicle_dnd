import React from 'react';
import { Player } from '../types';

interface PlayerTagsModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  campaignCode: string;
  onTagsSaved?: (tags: string[]) => void;
}

export function PlayerTagsModal(_props: PlayerTagsModalProps) {
  return null;
}
