#!/bin/bash
sed -i '/const INITIAL_ACCOUNTS: UserAccount\[\] = \[/,/\];/d' src/store/campaignStore.ts
sed -i 's/import { Note, Session, Entity, Player, Category, UserAccount, CampaignCalendar, SessionEvent }/import { Note, Session, Entity, Player, Category, UserAccount, CampaignCalendar, SessionEvent, CampaignMeta }/g' src/store/campaignStore.ts

