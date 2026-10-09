CREATE TYPE "public"."threshold_metric" AS ENUM('ftp', 'thresholdSpeed', 'lthr', 'maxHr', 'restingHr', 'weight');--> statement-breakpoint
CREATE TABLE "athlete_threshold" (
	"athlete_id" uuid NOT NULL,
	"metric" "threshold_metric" NOT NULL,
	"value" double precision,
	"valid_from" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "athlete_threshold_athlete_id_metric_valid_from_pk" PRIMARY KEY("athlete_id","metric","valid_from")
);
--> statement-breakpoint
ALTER TABLE "athlete_threshold" ADD CONSTRAINT "athlete_threshold_athlete_id_athlete_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athlete"("id") ON DELETE cascade ON UPDATE no action;