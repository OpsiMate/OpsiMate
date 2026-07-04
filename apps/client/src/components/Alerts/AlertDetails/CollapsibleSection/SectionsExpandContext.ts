import { createContext } from 'react';
import { SectionsExpandSignal } from './CollapsibleSection.types';

export const SectionsExpandContext = createContext<SectionsExpandSignal | null>(null);
