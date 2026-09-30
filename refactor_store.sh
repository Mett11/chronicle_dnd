#!/bin/bash
sed -i "s/const STORAGE_NOTES = 'chronicle_notes_v2';//g" src/store/campaignStore.ts
sed -i "s/const STORAGE_SESSIONS = 'chronicle_sessions_v2';//g" src/store/campaignStore.ts
sed -i "s/const STORAGE_ENTITIES = 'chronicle_entities_v2';//g" src/store/campaignStore.ts
sed -i "s/const STORAGE_AUTH_SESSION = 'chronicle_active_user_id';//g" src/store/campaignStore.ts
sed -i "s/const STORAGE_ACCOUNTS = 'chronicle_user_accounts';//g" src/store/campaignStore.ts
sed -i "s/const STORAGE_CALENDAR = 'chronicle_campaign_calendar_v2';//g" src/store/campaignStore.ts

sed -i "s/STORAGE_NOTES/this.getStorageKey('notes')/g" src/store/campaignStore.ts
sed -i "s/STORAGE_SESSIONS/this.getStorageKey('sessions')/g" src/store/campaignStore.ts
sed -i "s/STORAGE_ENTITIES/this.getStorageKey('entities')/g" src/store/campaignStore.ts
sed -i "s/STORAGE_AUTH_SESSION/this.getStorageKey('active_user_id')/g" src/store/campaignStore.ts
sed -i "s/STORAGE_ACCOUNTS/this.getStorageKey('user_accounts')/g" src/store/campaignStore.ts
sed -i "s/STORAGE_CALENDAR/this.getStorageKey('calendar')/g" src/store/campaignStore.ts

