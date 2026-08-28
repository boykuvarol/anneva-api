import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const expectedMigrations = [
  '20260828000000_baseline_existing_user',
  '20260828001000_expand_mvp_schema',
  '20260828002000_one_active_pregnancy_per_user',
] as const;

const expectedUserColumns: Record<
  string,
  {
    dataType: string;
    nullable: boolean;
    datetimePrecision?: number;
    requiresDefault?: boolean;
  }
> = {
  id: { dataType: 'text', nullable: false },
  firebaseUid: { dataType: 'text', nullable: true },
  email: { dataType: 'text', nullable: false },
  name: { dataType: 'text', nullable: true },
  createdAt: {
    dataType: 'timestamp without time zone',
    nullable: false,
    datetimePrecision: 3,
    requiresDefault: true,
  },
  updatedAt: {
    dataType: 'timestamp without time zone',
    nullable: false,
    datetimePrecision: 3,
  },
};

const expectedEnums = [
  'DatingMethod',
  'PregnancyStatus',
  'AppointmentStatus',
  'InsightType',
  'PreparationCategory',
] as const;

const expectedDomainTables = [
  'Pregnancy',
  'TrackingEntry',
  'Appointment',
  'PregnancyWeekContent',
  'PreparationTemplateItem',
  'UserPreparationItem',
  'BirthPlan',
  'BreathingExercise',
  'ExerciseCompletion',
  'Insight',
] as const;

type ColumnInfo = {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
  datetime_precision: number | null;
};

type UniqueIndexInfo = {
  index_name: string;
  columns: string[];
  is_primary: boolean;
};

type MigrationInfo = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
};

type AuditResult = {
  privateDbConnection: 'OK' | 'FAILED';
  selectOne: 'OK' | 'FAILED' | 'NOT_RUN';
  userTableExists: boolean;
  userColumns: ColumnInfo[];
  userPrimaryKey: string[];
  userUniqueIndexes: UniqueIndexInfo[];
  aggregateChecks: {
    totalUsers: number | null;
    nullEmailCount: number | null;
    duplicateEmailGroupCount: number | null;
    duplicateNonNullFirebaseUidGroupCount: number | null;
  };
  expansionConflicts: {
    existingEnums: Record<string, boolean>;
    existingTables: Record<string, boolean>;
    userCompatibilityColumns: Record<string, boolean>;
  };
  migrationHistory: {
    tableExists: boolean;
    expected: Record<string, 'APPLIED' | 'ROLLED_BACK' | 'NOT_RECORDED'>;
    recordedMigrations: Array<{
      migrationName: string;
      status: 'APPLIED' | 'ROLLED_BACK' | 'PENDING_OR_FAILED';
    }>;
  };
  reasons: string[];
};

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required.');
  }

  return databaseUrl;
}

function assertPrivateRailwayDatabaseUrl(databaseUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname.endsWith('.proxy.rlwy.net') ||
    hostname.includes('railway.app') ||
    hostname.includes('rlwy.net')
  ) {
    throw new Error('DATABASE_URL appears to use a public Railway TCP proxy.');
  }

  if (!hostname.endsWith('.railway.internal')) {
    throw new Error(
      'DATABASE_URL is not a Railway private network hostname ending in .railway.internal.',
    );
  }
}

function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
}

function normalizeDefault(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/::[a-zA-Z0-9_ ."]+/g, '').trim();
}

function indexHasColumn(indexes: UniqueIndexInfo[], column: string): boolean {
  return indexes.some(
    (index) => index.columns.length === 1 && index.columns[0] === column,
  );
}

function getMigrationStatus(
  migration: MigrationInfo,
): 'APPLIED' | 'ROLLED_BACK' | 'PENDING_OR_FAILED' {
  if (migration.rolled_back_at) {
    return 'ROLLED_BACK';
  }

  if (migration.finished_at) {
    return 'APPLIED';
  }

  return 'PENDING_OR_FAILED';
}

function compareUserSchema(result: AuditResult): void {
  const columnMap = new Map(
    result.userColumns.map((column) => [column.column_name, column]),
  );

  for (const [name, expected] of Object.entries(expectedUserColumns)) {
    const column = columnMap.get(name);
    if (!column) {
      result.reasons.push(`User.${name} column is missing.`);
      continue;
    }

    if (column.data_type !== expected.dataType) {
      result.reasons.push(
        `User.${name} type differs: expected ${expected.dataType}, found ${column.data_type}.`,
      );
    }

    if ((column.is_nullable === 'YES') !== expected.nullable) {
      result.reasons.push(`User.${name} nullability differs from baseline.`);
    }

    if (
      expected.datetimePrecision !== undefined &&
      column.datetime_precision !== expected.datetimePrecision
    ) {
      result.reasons.push(
        `User.${name} timestamp precision differs from baseline.`,
      );
    }

    if (expected.requiresDefault && !normalizeDefault(column.column_default)) {
      result.reasons.push(`User.${name} default is missing.`);
    }
  }

  const extraColumns = result.userColumns
    .map((column) => column.column_name)
    .filter((column) => !(column in expectedUserColumns));
  if (extraColumns.length > 0) {
    result.reasons.push(
      `User has columns beyond baseline: ${extraColumns.join(', ')}.`,
    );
  }

  if (result.userPrimaryKey.length !== 1 || result.userPrimaryKey[0] !== 'id') {
    result.reasons.push('User primary key is not exactly id.');
  }

  if (!indexHasColumn(result.userUniqueIndexes, 'email')) {
    result.reasons.push('User.email unique index/constraint is missing.');
  }

  if (!indexHasColumn(result.userUniqueIndexes, 'firebaseUid')) {
    result.reasons.push('User.firebaseUid unique index/constraint is missing.');
  }
}

function evaluateDecision(
  result: AuditResult,
): 'SAFE_TO_BASELINE' | 'DO_NOT_BASELINE' {
  if (result.privateDbConnection !== 'OK' || result.selectOne !== 'OK') {
    result.reasons.push('Private database connection did not succeed.');
  }

  if (!result.userTableExists) {
    result.reasons.push('public."User" table does not exist.');
  } else {
    compareUserSchema(result);
  }

  if ((result.aggregateChecks.nullEmailCount ?? 0) > 0) {
    result.reasons.push('User.email contains NULL rows.');
  }

  if ((result.aggregateChecks.duplicateEmailGroupCount ?? 0) > 0) {
    result.reasons.push('Duplicate User.email groups exist.');
  }

  if ((result.aggregateChecks.duplicateNonNullFirebaseUidGroupCount ?? 0) > 0) {
    result.reasons.push('Duplicate non-null User.firebaseUid groups exist.');
  }

  for (const [name, exists] of Object.entries(
    result.expansionConflicts.existingEnums,
  )) {
    if (exists) {
      result.reasons.push(`Expansion enum already exists: ${name}.`);
    }
  }

  for (const [name, exists] of Object.entries(
    result.expansionConflicts.existingTables,
  )) {
    if (exists) {
      result.reasons.push(`Expansion table already exists: ${name}.`);
    }
  }

  for (const [name, exists] of Object.entries(
    result.expansionConflicts.userCompatibilityColumns,
  )) {
    if (exists) {
      result.reasons.push(`Expansion User column already exists: ${name}.`);
    }
  }

  for (const [name, status] of Object.entries(
    result.migrationHistory.expected,
  )) {
    if (status === 'ROLLED_BACK') {
      result.reasons.push(`Expected migration is rolled back: ${name}.`);
    }

    if (status === 'APPLIED' && name === expectedMigrations[0]) {
      result.reasons.push(
        'Baseline migration is already recorded; do not resolve it again.',
      );
    }

    if (status === 'APPLIED' && name !== expectedMigrations[0]) {
      result.reasons.push(`Expansion migration is already recorded: ${name}.`);
    }
  }

  const failedMigration = result.migrationHistory.recordedMigrations.find(
    (migration) => migration.status === 'PENDING_OR_FAILED',
  );
  if (failedMigration) {
    result.reasons.push(
      'Migration history contains a pending or failed migration.',
    );
  }

  return result.reasons.length === 0 ? 'SAFE_TO_BASELINE' : 'DO_NOT_BASELINE';
}

async function runAudit(): Promise<void> {
  const databaseUrl = getDatabaseUrl();
  assertPrivateRailwayDatabaseUrl(databaseUrl);

  const prisma = createPrismaClient(databaseUrl);
  const result: AuditResult = {
    privateDbConnection: 'FAILED',
    selectOne: 'NOT_RUN',
    userTableExists: false,
    userColumns: [],
    userPrimaryKey: [],
    userUniqueIndexes: [],
    aggregateChecks: {
      totalUsers: null,
      nullEmailCount: null,
      duplicateEmailGroupCount: null,
      duplicateNonNullFirebaseUidGroupCount: null,
    },
    expansionConflicts: {
      existingEnums: Object.fromEntries(
        expectedEnums.map((name) => [name, false]),
      ),
      existingTables: Object.fromEntries(
        expectedDomainTables.map((name) => [name, false]),
      ),
      userCompatibilityColumns: {
        locale: false,
        onboardingCompleted: false,
      },
    },
    migrationHistory: {
      tableExists: false,
      expected: Object.fromEntries(
        expectedMigrations.map((name) => [name, 'NOT_RECORDED']),
      ) as AuditResult['migrationHistory']['expected'],
      recordedMigrations: [],
    },
    reasons: [],
  };

  try {
    const selectOne = await prisma.$queryRaw<Array<{ ok: number }>>`
      SELECT 1::int AS ok
    `;
    result.privateDbConnection = 'OK';
    result.selectOne = selectOne[0]?.ok === 1 ? 'OK' : 'FAILED';

    await prisma.$executeRaw`BEGIN`;
    await prisma.$executeRaw`SET TRANSACTION READ ONLY`;

    const userTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."User"') IS NOT NULL AS exists
    `;
    result.userTableExists = userTable[0]?.exists === true;

    if (result.userTableExists) {
      result.userColumns = await prisma.$queryRaw<ColumnInfo[]>`
        SELECT
          column_name,
          data_type,
          udt_name,
          is_nullable,
          column_default,
          datetime_precision
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'User'
        ORDER BY ordinal_position
      `;

      const primaryKey = await prisma.$queryRaw<Array<{ columns: string[] }>>`
        SELECT array_agg(a.attname ORDER BY x.ordinality) AS columns
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN unnest(c.conkey) WITH ORDINALITY AS x(attnum, ordinality) ON true
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
        WHERE n.nspname = 'public'
          AND t.relname = 'User'
          AND c.contype = 'p'
        GROUP BY c.conname
      `;
      result.userPrimaryKey = primaryKey[0]?.columns ?? [];

      result.userUniqueIndexes = await prisma.$queryRaw<UniqueIndexInfo[]>`
        SELECT
          i.relname AS index_name,
          array_agg(a.attname ORDER BY x.ordinality)
            FILTER (WHERE a.attname IS NOT NULL) AS columns,
          ix.indisprimary AS is_primary
        FROM pg_index ix
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_class i ON i.oid = ix.indexrelid
        LEFT JOIN unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ordinality) ON true
        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
        WHERE n.nspname = 'public'
          AND t.relname = 'User'
          AND ix.indisunique = true
        GROUP BY i.relname, ix.indisprimary
        ORDER BY i.relname
      `;

      const counts = await prisma.$queryRaw<
        Array<{
          total_users: bigint;
          null_email_count: bigint;
          duplicate_email_group_count: bigint;
          duplicate_non_null_firebase_uid_group_count: bigint;
        }>
      >`
        SELECT
          (SELECT count(*) FROM public."User") AS total_users,
          (SELECT count(*) FROM public."User" WHERE email IS NULL) AS null_email_count,
          (
            SELECT count(*) FROM (
              SELECT email FROM public."User" GROUP BY email HAVING count(*) > 1
            ) duplicate_email_groups
          ) AS duplicate_email_group_count,
          (
            SELECT count(*) FROM (
              SELECT "firebaseUid"
              FROM public."User"
              WHERE "firebaseUid" IS NOT NULL
              GROUP BY "firebaseUid"
              HAVING count(*) > 1
            ) duplicate_firebase_uid_groups
          ) AS duplicate_non_null_firebase_uid_group_count
      `;

      const aggregateChecks = counts[0];
      result.aggregateChecks = {
        totalUsers: Number(aggregateChecks?.total_users ?? 0),
        nullEmailCount: Number(aggregateChecks?.null_email_count ?? 0),
        duplicateEmailGroupCount: Number(
          aggregateChecks?.duplicate_email_group_count ?? 0,
        ),
        duplicateNonNullFirebaseUidGroupCount: Number(
          aggregateChecks?.duplicate_non_null_firebase_uid_group_count ?? 0,
        ),
      };
    }

    const existingEnums = await prisma.$queryRaw<Array<{ typname: string }>>`
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname IN (
          'DatingMethod',
          'PregnancyStatus',
          'AppointmentStatus',
          'InsightType',
          'PreparationCategory'
        )
    `;
    const existingEnumNames = new Set(
      existingEnums.map((item) => item.typname),
    );
    result.expansionConflicts.existingEnums = Object.fromEntries(
      expectedEnums.map((name) => [name, existingEnumNames.has(name)]),
    );

    const existingTables = await prisma.$queryRaw<Array<{ relname: string }>>`
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND c.relname IN (
          'Pregnancy',
          'TrackingEntry',
          'Appointment',
          'PregnancyWeekContent',
          'PreparationTemplateItem',
          'UserPreparationItem',
          'BirthPlan',
          'BreathingExercise',
          'ExerciseCompletion',
          'Insight'
        )
    `;
    const existingTableNames = new Set(
      existingTables.map((item) => item.relname),
    );
    result.expansionConflicts.existingTables = Object.fromEntries(
      expectedDomainTables.map((name) => [name, existingTableNames.has(name)]),
    );

    const userCompatibilityColumns = await prisma.$queryRaw<
      Array<{ column_name: string }>
    >`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'User'
        AND column_name IN ('locale', 'onboardingCompleted')
    `;
    const compatibilityColumnNames = new Set(
      userCompatibilityColumns.map((column) => column.column_name),
    );
    result.expansionConflicts.userCompatibilityColumns = {
      locale: compatibilityColumnNames.has('locale'),
      onboardingCompleted: compatibilityColumnNames.has('onboardingCompleted'),
    };

    const migrationTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS exists
    `;
    result.migrationHistory.tableExists = migrationTable[0]?.exists === true;

    if (result.migrationHistory.tableExists) {
      const migrations = await prisma.$queryRaw<MigrationInfo[]>`
        SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
        FROM public."_prisma_migrations"
        ORDER BY started_at ASC
      `;

      result.migrationHistory.recordedMigrations = migrations.map(
        (migration) => ({
          migrationName: migration.migration_name,
          status: getMigrationStatus(migration),
        }),
      );

      const migrationMap = new Map(
        migrations.map((migration) => [migration.migration_name, migration]),
      );
      result.migrationHistory.expected = Object.fromEntries(
        expectedMigrations.map((name) => {
          const migration = migrationMap.get(name);
          return [
            name,
            migration ? getMigrationStatus(migration) : 'NOT_RECORDED',
          ];
        }),
      ) as AuditResult['migrationHistory']['expected'];
    }

    await prisma.$executeRaw`ROLLBACK`;
  } catch (error) {
    await prisma.$executeRaw`ROLLBACK`.catch(() => undefined);
    result.reasons.push(
      error instanceof Error ? error.message : 'Unknown audit failure.',
    );
  } finally {
    await prisma.$disconnect();
  }

  const decision = evaluateDecision(result);
  console.log(`PRIVATE_DB_CONNECTION = ${result.privateDbConnection}`);
  console.log(`SELECT_1 = ${result.selectOne}`);
  console.log(JSON.stringify(result, null, 2));
  console.log(decision);
}

runAudit().catch((error: unknown) => {
  console.error('PRIVATE_DB_CONNECTION = FAILED');
  console.error('SELECT_1 = NOT_RUN');
  console.error(
    JSON.stringify(
      {
        PRIVATE_DB_CONNECTION: 'FAILED',
        reason:
          error instanceof Error ? error.message : 'Unknown audit failure.',
      },
      null,
      2,
    ),
  );
  console.log('DO_NOT_BASELINE');
  process.exitCode = 1;
});
