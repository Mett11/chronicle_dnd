const fs = require('fs');
let code = fs.readFileSync('src/components/LoreDatePicker.tsx', 'utf8');

const interfaceOld = `interface LoreDatePickerProps {
  value: string;
  onChange: (formattedDate: string, meta?: { startDay: number; endDay?: number; month: string; year: number }) => void;
  label?: string;
  hint?: string;
}`;

const interfaceNew = `interface LoreDatePickerProps {
  value: string;
  onChange: (formattedDate: string, meta?: { startDay: number; endDay?: number; month: string; year: number }) => void;
  label?: string;
  hint?: string;
  initialMeta?: { startDay: number; endDay?: number; month: string; year: number };
}`;
code = code.replace(interfaceOld, interfaceNew);


const initOld = `export function LoreDatePicker({
  value,
  onChange,
  label = 'Data Lore nel Calendario di Campagna',
  hint = 'Specifica il giorno o l’intervallo di giorni in-game vissuti dai personaggi',
}: LoreDatePickerProps) {
  const [calendar, setCalendar] = useState<CampaignCalendar>(() => CampaignManager.getCalendar());
  const [monthIndex, setMonthIndex] = useState<number>(calendar.currentMonthIndex || 0);
  const [startDay, setStartDay] = useState<number>(calendar.currentDay || 1);
  const [endDay, setEndDay] = useState<number | ''>('');
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [year, setYear] = useState<number>(calendar.currentYear || 1492);`;

const initNew = `export function LoreDatePicker({
  value,
  onChange,
  label = 'Data Lore nel Calendario di Campagna',
  hint = 'Specifica il giorno o l’intervallo di giorni in-game vissuti dai personaggi',
  initialMeta,
}: LoreDatePickerProps) {
  const [calendar, setCalendar] = useState<CampaignCalendar>(() => CampaignManager.getCalendar());

  // Determine initial values based on initialMeta if available
  const initialMonthIdx = initialMeta 
    ? calendar.months.findIndex(m => m.name === initialMeta.month)
    : calendar.currentMonthIndex || 0;
    
  const validMonthIdx = initialMonthIdx !== -1 ? initialMonthIdx : (calendar.currentMonthIndex || 0);

  const [monthIndex, setMonthIndex] = useState<number>(validMonthIdx);
  const [startDay, setStartDay] = useState<number>(initialMeta ? initialMeta.startDay : (calendar.currentDay || 1));
  const [endDay, setEndDay] = useState<number | ''>(initialMeta?.endDay || '');
  const [isMultiDay, setIsMultiDay] = useState(!!initialMeta?.endDay);
  const [year, setYear] = useState<number>(initialMeta?.year || calendar.currentYear || 1492);

  // Sync state if initialMeta changes externally (e.g. switching selected session)
  useEffect(() => {
    if (initialMeta) {
      const mIdx = calendar.months.findIndex(m => m.name === initialMeta.month);
      setMonthIndex(mIdx !== -1 ? mIdx : 0);
      setStartDay(initialMeta.startDay);
      setEndDay(initialMeta.endDay || '');
      setIsMultiDay(!!initialMeta.endDay);
      setYear(initialMeta.year);
    }
  }, [initialMeta, calendar]);
`;

code = code.replace(initOld, initNew);

fs.writeFileSync('src/components/LoreDatePicker.tsx', code);
