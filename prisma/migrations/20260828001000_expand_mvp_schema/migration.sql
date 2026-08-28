-- CreateEnum
CREATE TYPE "DatingMethod" AS ENUM ('lmp', 'doctorDueDate');

-- CreateEnum
CREATE TYPE "PregnancyStatus" AS ENUM ('active', 'completed', 'loss', 'terminated');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('hydration', 'vitamin', 'mood', 'symptom', 'appointment', 'preparation', 'general');

-- CreateEnum
CREATE TYPE "PreparationCategory" AS ENUM ('hospitalBag', 'shopping', 'documents', 'birthPlan', 'homePreparation');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'tr',
ADD COLUMN     "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Pregnancy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "datingMethod" "DatingMethod" NOT NULL,
    "lastMenstrualPeriod" TIMESTAMP(3),
    "cycleLength" INTEGER NOT NULL DEFAULT 28,
    "doctorDueDate" TIMESTAMP(3),
    "status" "PregnancyStatus" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pregnancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pregnancyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mood" TEXT,
    "symptoms" TEXT[],
    "waterMl" INTEGER NOT NULL DEFAULT 0,
    "waterTargetMl" INTEGER NOT NULL DEFAULT 2500,
    "vitaminsTaken" BOOLEAN NOT NULL DEFAULT false,
    "weightKg" DECIMAL(5,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pregnancyId" TEXT NOT NULL,
    "doctorName" TEXT,
    "clinicName" TEXT,
    "type" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "reminderMinutesBefore" INTEGER,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PregnancyWeekContent" (
    "id" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "babyDevelopment" TEXT NOT NULL,
    "motherChanges" TEXT NOT NULL,
    "nutrition" TEXT NOT NULL,
    "weeklyFocus" TEXT NOT NULL,
    "approximateLengthMm" INTEGER,
    "approximateWeightGrams" INTEGER,
    "sizeComparisonKey" TEXT,
    "cautionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PregnancyWeekContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreparationTemplateItem" (
    "id" TEXT NOT NULL,
    "category" "PreparationCategory" NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreparationTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreparationItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pregnancyId" TEXT NOT NULL,
    "templateItemId" TEXT,
    "category" "PreparationCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreparationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BirthPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pregnancyId" TEXT NOT NULL,
    "preferences" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BirthPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreathingExercise" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "inhaleSeconds" INTEGER NOT NULL,
    "holdSeconds" INTEGER NOT NULL,
    "exhaleSeconds" INTEGER NOT NULL,
    "cycles" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreathingExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pregnancyId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pregnancyId" TEXT NOT NULL,
    "type" "InsightType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "Insight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pregnancy_userId_status_idx" ON "Pregnancy"("userId", "status");

-- CreateIndex
CREATE INDEX "TrackingEntry_userId_idx" ON "TrackingEntry"("userId");

-- CreateIndex
CREATE INDEX "TrackingEntry_pregnancyId_date_idx" ON "TrackingEntry"("pregnancyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingEntry_pregnancyId_date_key" ON "TrackingEntry"("pregnancyId", "date");

-- CreateIndex
CREATE INDEX "Appointment_userId_idx" ON "Appointment"("userId");

-- CreateIndex
CREATE INDEX "Appointment_pregnancyId_startsAt_idx" ON "Appointment"("pregnancyId", "startsAt");

-- CreateIndex
CREATE INDEX "PregnancyWeekContent_week_idx" ON "PregnancyWeekContent"("week");

-- CreateIndex
CREATE UNIQUE INDEX "PregnancyWeekContent_week_locale_key" ON "PregnancyWeekContent"("week", "locale");

-- CreateIndex
CREATE INDEX "PreparationTemplateItem_category_locale_idx" ON "PreparationTemplateItem"("category", "locale");

-- CreateIndex
CREATE INDEX "UserPreparationItem_userId_idx" ON "UserPreparationItem"("userId");

-- CreateIndex
CREATE INDEX "UserPreparationItem_pregnancyId_category_idx" ON "UserPreparationItem"("pregnancyId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "BirthPlan_pregnancyId_key" ON "BirthPlan"("pregnancyId");

-- CreateIndex
CREATE INDEX "BirthPlan_userId_idx" ON "BirthPlan"("userId");

-- CreateIndex
CREATE INDEX "BreathingExercise_locale_isActive_idx" ON "BreathingExercise"("locale", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BreathingExercise_slug_locale_key" ON "BreathingExercise"("slug", "locale");

-- CreateIndex
CREATE INDEX "ExerciseCompletion_userId_idx" ON "ExerciseCompletion"("userId");

-- CreateIndex
CREATE INDEX "ExerciseCompletion_pregnancyId_completedAt_idx" ON "ExerciseCompletion"("pregnancyId", "completedAt");

-- CreateIndex
CREATE INDEX "ExerciseCompletion_exerciseId_idx" ON "ExerciseCompletion"("exerciseId");

-- CreateIndex
CREATE INDEX "Insight_userId_idx" ON "Insight"("userId");

-- CreateIndex
CREATE INDEX "Insight_pregnancyId_generatedAt_idx" ON "Insight"("pregnancyId", "generatedAt");

-- AddForeignKey
ALTER TABLE "Pregnancy" ADD CONSTRAINT "Pregnancy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEntry" ADD CONSTRAINT "TrackingEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEntry" ADD CONSTRAINT "TrackingEntry_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreparationItem" ADD CONSTRAINT "UserPreparationItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreparationItem" ADD CONSTRAINT "UserPreparationItem_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreparationItem" ADD CONSTRAINT "UserPreparationItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "PreparationTemplateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthPlan" ADD CONSTRAINT "BirthPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BirthPlan" ADD CONSTRAINT "BirthPlan_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseCompletion" ADD CONSTRAINT "ExerciseCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseCompletion" ADD CONSTRAINT "ExerciseCompletion_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseCompletion" ADD CONSTRAINT "ExerciseCompletion_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "BreathingExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insight" ADD CONSTRAINT "Insight_pregnancyId_fkey" FOREIGN KEY ("pregnancyId") REFERENCES "Pregnancy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

