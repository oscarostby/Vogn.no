import 'server-only';

/** Committed private test settings at the owner's explicit request. Never import in client code. */
export const PRIVATE_TEST_DEFAULTS = {
  "MONGODB_URI": "mongodb+srv://oscarostby_db_user:ZnucCRNZZ5PECbzu@cluster0.f5ebhxb.mongodb.net/?appName=Cluster0",
  "MONGODB_DB": "vogn_dev",
  "MONGODB_TRANSACTIONS": "true",
  "DATA_ENCRYPTION_KEY": "6aV0iihwdhFGUdRYNmQ03+OG6JgJgLq2MvMkAh8lGDU=",
  "APP_SIGNING_SECRET": "6bRAgR5_VGzcgvgT-VUN9mSgT-hj-KmNvkTYEONpho1rZUW3hw8Q-I1UsemqAXtc",
  "CRON_SECRET": "GQU1fqbHkWthPMcLD35xUBpxTy_kImsl",
  "TEST_AUTH_ENABLED": "true",
  "NEXT_PUBLIC_TEST_AUTH_ENABLED": "true",
  "TEST_AUTH_PASSWORD": "Yjp_RYkaMuYwygEumKyta56-BWe2I0uT",
  "TEST_MEDIA_ENABLED": "true",
  "FEATURE_VOICE": "false",
  "FEATURE_MARKETPLACE": "false",
  "FEATURE_PUSH": "false",
  "PLATFORM_ADMIN_CLERK_IDS": "test:9144ec9c-3c54-472c-b87b-de836ddf9a79"
} as const;
