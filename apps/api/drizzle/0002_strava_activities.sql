CREATE TYPE "public"."activity_provider" AS ENUM('strava');--> statement-breakpoint
ALTER TYPE "public"."session_source" ADD VALUE 'import';--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"provider" "activity_provider" NOT NULL,
	"external_id" text NOT NULL,
	"session_id" uuid,
	"sport_id" text NOT NULL,
	"name" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"local_date" date NOT NULL,
	"local_time" time NOT NULL,
	"moving_sec" integer NOT NULL,
	"elapsed_sec" integer NOT NULL,
	"distance_m" double precision,
	"elevation_gain_m" double precision,
	"avg_hr" double precision,
	"max_hr" double precision,
	"avg_watts" double precision,
	"normalized_watts" double precision,
	"avg_speed" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration" (
	"athlete_id" uuid NOT NULL,
	"provider" "activity_provider" NOT NULL,
	"external_user_id" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"connected_by" text,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_athlete_id_provider_pk" PRIMARY KEY("athlete_id","provider")
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_session_id_planned_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."planned_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_sport_id_sport_id_fk" FOREIGN KEY ("sport_id") REFERENCES "public"."sport"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_connected_by_user_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activity_provider_external_idx" ON "activity" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "activity_athlete_date_idx" ON "activity" USING btree ("athlete_id","local_date");--> statement-breakpoint
CREATE INDEX "activity_session_idx" ON "activity" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_external_user_idx" ON "integration" USING btree ("provider","external_user_id");