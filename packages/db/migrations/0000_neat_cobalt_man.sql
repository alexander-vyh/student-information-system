CREATE SCHEMA "core";
--> statement-breakpoint
CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE SCHEMA "student";
--> statement-breakpoint
CREATE SCHEMA "curriculum";
--> statement-breakpoint
CREATE SCHEMA "enrollment";
--> statement-breakpoint
CREATE SCHEMA "financial";
--> statement-breakpoint
CREATE SCHEMA "aid";
--> statement-breakpoint
CREATE SCHEMA "scheduling";
--> statement-breakpoint
CREATE SCHEMA "system";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."academic_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"aid_year_code" varchar(10),
	"is_current" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campus_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"address" varchar(200),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"term_id" uuid,
	"name" varchar(200) NOT NULL,
	"description" text,
	"event_type" varchar(50) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"campus_closed" boolean DEFAULT false,
	"classes_held" boolean DEFAULT true,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."campuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"address_1" varchar(100),
	"address_2" varchar(100),
	"city" varchar(100),
	"state" varchar(2),
	"postal_code" varchar(10),
	"country" varchar(2) DEFAULT 'US',
	"is_main_campus" boolean DEFAULT false,
	"branch_id" varchar(10),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."institutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"short_name" varchar(50),
	"opeid" varchar(8),
	"ipeds_id" varchar(6),
	"fice_code" varchar(6),
	"address_1" varchar(100),
	"address_2" varchar(100),
	"city" varchar(100),
	"state" varchar(2),
	"postal_code" varchar(10),
	"country" varchar(2) DEFAULT 'US',
	"phone" varchar(20),
	"website" varchar(200),
	"accrediting_body" varchar(100),
	"accreditation_status" varchar(50),
	"settings" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "institutions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"building_id" uuid NOT NULL,
	"room_number" varchar(20) NOT NULL,
	"name" varchar(100),
	"room_type" varchar(50),
	"capacity" integer,
	"features" jsonb,
	"is_schedulable" boolean DEFAULT true,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."term_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"census_date" date,
	"add_deadline" date,
	"drop_deadline" date,
	"withdrawal_deadline" date,
	"refund_deadline_100" date,
	"refund_deadline_75" date,
	"refund_deadline_50" date,
	"refund_deadline_25" date,
	"aid_disbursement_date" date,
	"is_default" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"academic_year_id" uuid,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"short_name" varchar(20),
	"term_type" varchar(20) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"census_date" date,
	"registration_start_date" date,
	"registration_end_date" date,
	"add_deadline" date,
	"drop_deadline" date,
	"withdrawal_deadline" date,
	"midterm_grades_due" date,
	"final_grades_due" date,
	"tuition_due_date" date,
	"refund_deadline_100" date,
	"refund_deadline_75" date,
	"refund_deadline_50" date,
	"refund_deadline_25" date,
	"aid_disbursement_date" date,
	"is_current" boolean DEFAULT false,
	"is_visible" boolean DEFAULT true,
	"allow_registration" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"user_id" uuid,
	"user_email" varchar(255),
	"action" varchar(50) NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid,
	"student_id" uuid,
	"ip_address" "inet",
	"user_agent" text,
	"request_path" varchar(500),
	"request_method" varchar(10),
	"changes" jsonb,
	"metadata" jsonb,
	"success" boolean DEFAULT true,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"id_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"resource" varchar(50) NOT NULL,
	"action" varchar(20) NOT NULL,
	"supports_self_scope" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"scope" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"role_type" varchar(20) DEFAULT 'functional' NOT NULL,
	"is_system" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_token" varchar(255) NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"scope_type" varchar(50),
	"scope_id" uuid,
	"effective_from" timestamp with time zone DEFAULT now(),
	"effective_until" timestamp with time zone,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp with time zone,
	"password_hash" varchar(255),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"preferred_name" varchar(100),
	"display_name" varchar(200),
	"external_id" varchar(100),
	"employee_id" varchar(50),
	"phone" varchar(20),
	"avatar_url" varchar(500),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"failed_login_attempts" varchar(10) DEFAULT '0',
	"locked_until" timestamp with time zone,
	"mfa_enabled" boolean DEFAULT false,
	"mfa_secret" varchar(255),
	"password_changed_at" timestamp with time zone,
	"must_change_password" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student"."academic_standing_appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"standing_history_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"appeal_date" date NOT NULL,
	"appeal_reason" text NOT NULL,
	"supporting_documents" jsonb,
	"academic_plan_submitted" boolean DEFAULT false,
	"academic_plan_details" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text,
	"resulting_standing" varchar(30),
	"approval_conditions" text,
	"conditions_met" boolean,
	"conditions_met_date" date,
	"student_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student"."academic_standing_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"student_program_id" uuid,
	"term_id" uuid NOT NULL,
	"policy_id" uuid,
	"standing" varchar(30) NOT NULL,
	"previous_standing" varchar(30),
	"term_gpa" numeric(4, 3),
	"cumulative_gpa" numeric(4, 3),
	"term_credits_attempted" numeric(8, 2),
	"term_credits_earned" numeric(8, 2),
	"cumulative_credits_attempted" numeric(8, 2),
	"cumulative_credits_earned" numeric(8, 2),
	"consecutive_probation_terms" integer DEFAULT 0,
	"total_probation_terms" integer DEFAULT 0,
	"total_suspensions" integer DEFAULT 0,
	"reason" text,
	"internal_notes" text,
	"is_automatic" boolean DEFAULT true NOT NULL,
	"determined_by" uuid,
	"determined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"student_notified_at" timestamp with time zone,
	"notification_method" varchar(30),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student"."academic_standing_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(30) NOT NULL,
	"description" text,
	"level_code" varchar(20),
	"good_standing_min_gpa" numeric(4, 3) DEFAULT '2.000' NOT NULL,
	"warning_min_gpa" numeric(4, 3),
	"probation_min_gpa" numeric(4, 3),
	"probation_max_terms" integer DEFAULT 2,
	"suspension_duration_terms" integer DEFAULT 1,
	"max_suspensions" integer DEFAULT 2,
	"thresholds_by_credits" jsonb,
	"requires_minimum_credits" boolean DEFAULT false,
	"minimum_credits_per_term" numeric(5, 2),
	"evaluate_after_each_term" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" date,
	"effective_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student"."cohorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"cohort_type" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student"."student_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"address_type" varchar(20) NOT NULL,
	"address_1" varchar(100) NOT NULL,
	"address_2" varchar(100),
	"city" varchar(100) NOT NULL,
	"state" varchar(50),
	"postal_code" varchar(20),
	"country" varchar(2) DEFAULT 'US' NOT NULL,
	"county" varchar(100),
	"is_primary" boolean DEFAULT false,
	"effective_from" date,
	"effective_until" date,
	"is_verified" boolean DEFAULT false,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student"."student_advisors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"advisor_id" uuid NOT NULL,
	"advisor_type" varchar(30) NOT NULL,
	"student_program_id" uuid,
	"is_primary" boolean DEFAULT false,
	"assigned_date" date,
	"end_date" date,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student"."student_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"attribute_code" varchar(50) NOT NULL,
	"attribute_value" text,
	"effective_from" date,
	"effective_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student"."student_cohorts" (
	"student_id" uuid NOT NULL,
	"cohort_id" uuid NOT NULL,
	"joined_date" date,
	"left_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_cohorts_student_id_cohort_id_pk" PRIMARY KEY("student_id","cohort_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student"."student_gpa_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"student_program_id" uuid,
	"cumulative_attempted_credits" numeric(8, 2) DEFAULT '0',
	"cumulative_earned_credits" numeric(8, 2) DEFAULT '0',
	"cumulative_quality_points" numeric(10, 2) DEFAULT '0',
	"cumulative_gpa" numeric(4, 3),
	"in_progress_credits" numeric(8, 2) DEFAULT '0',
	"transfer_credits" numeric(8, 2) DEFAULT '0',
	"last_term_id" uuid,
	"last_term_attempted_credits" numeric(8, 2),
	"last_term_earned_credits" numeric(8, 2),
	"last_term_gpa" numeric(4, 3),
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student"."student_majors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_program_id" uuid NOT NULL,
	"major_id" uuid NOT NULL,
	"major_type" varchar(20) NOT NULL,
	"declared_date" date,
	"completed_date" date,
	"is_primary" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student"."student_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"note_type" varchar(30),
	"subject" varchar(200),
	"content" text NOT NULL,
	"is_confidential" boolean DEFAULT false,
	"visible_to_student" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student"."student_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"campus_id" uuid,
	"catalog_year_id" uuid,
	"concentration_id" uuid,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"admit_term_id" uuid,
	"start_date" date,
	"expected_graduation_date" date,
	"actual_graduation_date" date,
	"academic_standing" varchar(30),
	"is_primary" boolean DEFAULT true,
	"degree_awarded_date" date,
	"diploma_name" varchar(200),
	"honors_designation" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "student"."students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"user_id" uuid,
	"student_id" varchar(20) NOT NULL,
	"legal_first_name" varchar(100) NOT NULL,
	"legal_middle_name" varchar(100),
	"legal_last_name" varchar(100) NOT NULL,
	"suffix" varchar(20),
	"preferred_first_name" varchar(100),
	"preferred_last_name" varchar(100),
	"previous_last_name" varchar(100),
	"date_of_birth" date,
	"gender" varchar(20),
	"pronouns" varchar(50),
	"hispanic_latino" boolean,
	"races" jsonb,
	"citizenship_status" varchar(20),
	"citizenship_country" varchar(2),
	"visa_type" varchar(10),
	"ssn_encrypted" varchar(255),
	"ssn_last_4" varchar(4),
	"primary_email" varchar(255) NOT NULL,
	"institutional_email" varchar(255),
	"primary_phone" varchar(20),
	"mobile_phone" varchar(20),
	"emergency_contact_name" varchar(200),
	"emergency_contact_relationship" varchar(50),
	"emergency_contact_phone" varchar(20),
	"photo_url" varchar(500),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"first_enrollment_date" date,
	"most_recent_enrollment_date" date,
	"ferpa_block" boolean DEFAULT false,
	"ferpa_block_date" date,
	"first_generation" boolean,
	"veteran_status" varchar(30),
	"deceased_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."catalog_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_current" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."colleges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"short_name" varchar(50),
	"dean_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."course_requisites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"requisite_type" varchar(20) NOT NULL,
	"requisite_course_id" uuid,
	"minimum_grade" varchar(5),
	"requisite_rule" jsonb,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"department_id" uuid,
	"course_number" varchar(20) NOT NULL,
	"title" varchar(200) NOT NULL,
	"short_title" varchar(50),
	"course_code" varchar(30),
	"credit_hours_min" numeric(4, 2) NOT NULL,
	"credit_hours_max" numeric(4, 2),
	"credit_hours_default" numeric(4, 2),
	"billing_hours_min" numeric(4, 2),
	"billing_hours_max" numeric(4, 2),
	"lecture_hours" numeric(4, 2),
	"lab_hours" numeric(4, 2),
	"description" text,
	"course_level" varchar(20),
	"grade_mode" varchar(20) DEFAULT 'standard',
	"is_repeatable" boolean DEFAULT false,
	"max_repeat_credits" numeric(4, 2),
	"repeat_grade_policy" varchar(20),
	"schedule_type" varchar(20),
	"attributes" jsonb,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"effective_start_date" date,
	"effective_end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."cross_listed_sections" (
	"primary_section_id" uuid NOT NULL,
	"cross_listed_section_id" uuid NOT NULL,
	"share_enrollment_cap" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cross_listed_sections_primary_section_id_cross_listed_section_id_pk" PRIMARY KEY("primary_section_id","cross_listed_section_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."degree_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"level" varchar(20) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"college_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"short_name" varchar(50),
	"chair_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."grade_scales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_scale_id" uuid NOT NULL,
	"grade_code" varchar(5) NOT NULL,
	"grade_points" numeric(4, 3),
	"count_in_gpa" boolean DEFAULT true,
	"earned_credits" boolean DEFAULT true,
	"attempted_credits" boolean DEFAULT true,
	"is_incomplete" boolean DEFAULT false,
	"is_withdrawal" boolean DEFAULT false,
	"is_pass_fail" boolean DEFAULT false,
	"is_audit" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."majors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"department_id" uuid,
	"code" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"major_type" varchar(20) NOT NULL,
	"cip_code" varchar(20),
	"total_credits" numeric(5, 2),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."program_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"catalog_year_id" uuid,
	"category_id" uuid,
	"name" varchar(200) NOT NULL,
	"description" text,
	"minimum_credits" numeric(5, 2),
	"maximum_credits" numeric(5, 2),
	"minimum_courses" integer,
	"minimum_gpa" numeric(4, 3),
	"allow_sharing" boolean DEFAULT false,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"degree_type_id" uuid,
	"code" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"short_name" varchar(50),
	"cip_code" varchar(20),
	"description" text,
	"total_credits" numeric(5, 2),
	"typical_duration" integer,
	"is_stem" boolean DEFAULT false,
	"admission_requirements" text,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"effective_start_date" date,
	"effective_end_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."requirement_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."requirement_course_group_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."requirement_course_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"minimum_courses" integer,
	"minimum_credits" numeric(5, 2),
	"selection_rule" jsonb,
	"display_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."requirement_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"is_required" boolean DEFAULT true,
	"minimum_grade" varchar(5),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."section_instructors" (
	"section_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	"role" varchar(30) DEFAULT 'instructor',
	"is_primary" boolean DEFAULT false,
	"responsibility_percentage" integer DEFAULT 100,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "section_instructors_section_id_instructor_id_pk" PRIMARY KEY("section_id","instructor_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."section_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"meeting_type" varchar(20),
	"days_of_week" jsonb,
	"start_time" time,
	"end_time" time,
	"room_id" uuid,
	"location_override" varchar(100),
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"campus_id" uuid,
	"section_number" varchar(10) NOT NULL,
	"crn" varchar(20),
	"title_override" varchar(200),
	"credit_hours" numeric(4, 2) NOT NULL,
	"billing_hours" numeric(4, 2),
	"max_enrollment" integer DEFAULT 30,
	"current_enrollment" integer DEFAULT 0,
	"waitlist_max" integer DEFAULT 0,
	"waitlist_current" integer DEFAULT 0,
	"primary_instructor_id" uuid,
	"instructional_method" varchar(30),
	"start_date" date,
	"end_date" date,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"restriction_rules" jsonb,
	"section_fee" numeric(10, 2),
	"attributes" jsonb,
	"public_notes" text,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."student_degree_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"student_program_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"catalog_year_id" uuid,
	"audit_date" timestamp with time zone DEFAULT now() NOT NULL,
	"total_credits_required" numeric(5, 2),
	"total_credits_earned" numeric(5, 2),
	"total_credits_in_progress" numeric(5, 2),
	"overall_gpa_required" numeric(4, 3),
	"overall_gpa_actual" numeric(4, 3),
	"major_gpa_required" numeric(4, 3),
	"major_gpa_actual" numeric(4, 3),
	"completion_percentage" numeric(5, 2),
	"requirements_status" jsonb,
	"courses_applied" jsonb,
	"status" varchar(20) DEFAULT 'calculated',
	"generated_by" uuid,
	"advisor_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "curriculum"."subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"department_id" uuid,
	"code" varchar(10) NOT NULL,
	"name" varchar(200) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment"."attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"class_date" date NOT NULL,
	"status" varchar(20) NOT NULL,
	"check_in_time" timestamp with time zone,
	"check_out_time" timestamp with time zone,
	"recorded_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment"."census_snapshot_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"enrollment_status" varchar(20) NOT NULL,
	"enrollment_type" varchar(20) NOT NULL,
	"credit_hours" numeric(5, 2) NOT NULL,
	"fte" numeric(5, 3) NOT NULL,
	"program_id" uuid,
	"level" varchar(20),
	"gender" varchar(10),
	"ethnicity" varchar(50),
	"residency" varchar(20),
	"age_at_census" integer,
	"nsc_enrollment_status" varchar(1),
	"nsc_program_cip" varchar(10),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment"."census_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"session_id" uuid,
	"snapshot_date" date NOT NULL,
	"snapshot_type" varchar(30) DEFAULT 'census',
	"total_headcount" integer,
	"full_time_count" integer,
	"part_time_count" integer,
	"half_time_count" integer,
	"less_than_half_time_count" integer,
	"total_fte" numeric(10, 2),
	"undergraduate_fte" numeric(10, 2),
	"graduate_fte" numeric(10, 2),
	"total_credit_hours" numeric(12, 2),
	"demographics_breakdown" jsonb,
	"snapshot_data" jsonb,
	"generated_at" timestamp with time zone DEFAULT now(),
	"generated_by" uuid,
	"status" varchar(20) DEFAULT 'draft',
	"nsc_file_generated_at" timestamp with time zone,
	"nsc_file_name" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment"."hold_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(20) NOT NULL,
	"blocks_registration" boolean DEFAULT true,
	"blocks_grades" boolean DEFAULT false,
	"blocks_transcript" boolean DEFAULT false,
	"blocks_diploma" boolean DEFAULT false,
	"blocks_graduation" boolean DEFAULT false,
	"release_authority" varchar(100),
	"release_authority_email" varchar(200),
	"resolution_instructions" text,
	"resolution_url" varchar(500),
	"is_automated" boolean DEFAULT false,
	"automation_rule" jsonb,
	"severity" varchar(20) DEFAULT 'standard',
	"is_active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"changed_by" uuid,
	"change_reason" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment"."priority_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"priority_level" integer NOT NULL,
	"membership_type" varchar(30) DEFAULT 'manual',
	"membership_attribute" varchar(50),
	"minimum_credits" numeric(5, 2),
	"is_federally_mandated" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"changed_by" uuid,
	"change_reason" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment"."registration_appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"priority_group_id" uuid,
	"effective_priority_level" integer NOT NULL,
	"appointment_start" timestamp with time zone NOT NULL,
	"appointment_end" timestamp with time zone,
	"credits_earned_at_generation" numeric(5, 2),
	"generated_at" timestamp with time zone DEFAULT now(),
	"generated_by" uuid,
	"is_manual_override" boolean DEFAULT false,
	"override_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment"."registration_change_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"change_type" varchar(30) NOT NULL,
	"previous_status" varchar(20),
	"new_status" varchar(20),
	"previous_grade" varchar(5),
	"new_grade" varchar(5),
	"changed_by" uuid,
	"change_reason" text,
	"refund_amount" numeric(10, 2),
	"charge_amount" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment"."registration_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"hold_type_id" uuid,
	"hold_type" varchar(30) NOT NULL,
	"hold_code" varchar(20) NOT NULL,
	"hold_name" varchar(100) NOT NULL,
	"description" text,
	"blocks_registration" boolean DEFAULT true,
	"blocks_grades" boolean DEFAULT false,
	"blocks_transcript" boolean DEFAULT false,
	"blocks_diploma" boolean DEFAULT false,
	"release_authority" varchar(50),
	"effective_from" timestamp with time zone DEFAULT now(),
	"effective_until" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_notes" text,
	"placed_by" uuid,
	"placed_by_office" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment"."registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"credit_hours" numeric(4, 2) NOT NULL,
	"billing_hours" numeric(4, 2),
	"status" varchar(20) DEFAULT 'registered' NOT NULL,
	"registration_method" varchar(20),
	"grade_mode" varchar(20) DEFAULT 'standard',
	"grade_id" uuid,
	"grade_code" varchar(5),
	"grade_points" numeric(4, 3),
	"credits_attempted" numeric(4, 2),
	"credits_earned" numeric(4, 2),
	"quality_points" numeric(6, 2),
	"include_in_gpa" boolean DEFAULT true,
	"midterm_grade_id" uuid,
	"midterm_grade_code" varchar(5),
	"is_repeat" boolean DEFAULT false,
	"repeat_of_registration_id" uuid,
	"repeat_action" varchar(20),
	"registration_date" timestamp with time zone DEFAULT now(),
	"drop_date" timestamp with time zone,
	"withdrawal_date" timestamp with time zone,
	"grade_posted_date" timestamp with time zone,
	"last_attendance_date" date,
	"prerequisite_override" boolean DEFAULT false,
	"capacity_override" boolean DEFAULT false,
	"restriction_override" boolean DEFAULT false,
	"override_reason" text,
	"override_by" uuid,
	"instructor_permission" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment"."term_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"student_program_id" uuid,
	"term_id" uuid NOT NULL,
	"enrollment_status" varchar(20) DEFAULT 'enrolled' NOT NULL,
	"enrollment_type" varchar(20),
	"registered_credits" numeric(5, 2) DEFAULT '0',
	"attempted_credits" numeric(5, 2),
	"earned_credits" numeric(5, 2),
	"quality_points" numeric(8, 2),
	"term_gpa" numeric(4, 3),
	"academic_standing" varchar(30),
	"honors" jsonb,
	"full_time_credits_required" numeric(4, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment"."test_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"test_code" varchar(30) NOT NULL,
	"test_name" varchar(100),
	"test_date" date,
	"score_type" varchar(30),
	"score" numeric(8, 2) NOT NULL,
	"max_score" numeric(8, 2),
	"percentile" integer,
	"credit_awarded" numeric(4, 2),
	"equivalent_course_id" uuid,
	"status" varchar(20) DEFAULT 'official' NOT NULL,
	"source_document" varchar(100),
	"received_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment"."transfer_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"source_institution_name" varchar(200) NOT NULL,
	"source_institution_code" varchar(20),
	"source_institution_type" varchar(30),
	"source_course_code" varchar(30),
	"source_course_title" varchar(200),
	"source_credits" numeric(4, 2) NOT NULL,
	"source_grade" varchar(10),
	"equivalent_course_id" uuid,
	"transfer_credits" numeric(4, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'approved' NOT NULL,
	"evaluated_by" uuid,
	"evaluated_at" timestamp with time zone,
	"evaluation_notes" text,
	"include_in_gpa" boolean DEFAULT false,
	"transcript_received_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment"."waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"notified_at" timestamp with time zone,
	"notification_expires_at" timestamp with time zone,
	"status" varchar(20) DEFAULT 'waiting' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"account_number" varchar(20) NOT NULL,
	"current_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pending_charges" numeric(12, 2) DEFAULT '0',
	"pending_credits" numeric(12, 2) DEFAULT '0',
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"has_financial_hold" boolean DEFAULT false,
	"on_payment_plan" boolean DEFAULT false,
	"payment_plan_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial"."charge_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"category" varchar(30) NOT NULL,
	"is_qtre" boolean DEFAULT false,
	"box_1_eligible" boolean DEFAULT false,
	"gl_account_code" varchar(30),
	"refundable" boolean DEFAULT true,
	"refund_rule_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial"."financial_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"hold_type" varchar(30) NOT NULL,
	"hold_code" varchar(20) NOT NULL,
	"hold_name" varchar(100) NOT NULL,
	"description" text,
	"threshold_amount" numeric(12, 2),
	"current_amount" numeric(12, 2),
	"blocks_registration" boolean DEFAULT true,
	"blocks_grades" boolean DEFAULT false,
	"blocks_transcript" boolean DEFAULT false,
	"blocks_diploma" boolean DEFAULT false,
	"auto_release_threshold" numeric(12, 2),
	"effective_from" timestamp with time zone DEFAULT now(),
	"effective_until" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial"."form_1098t_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"tax_year" smallint NOT NULL,
	"box_1_amount" numeric(12, 2) DEFAULT '0',
	"box_4_amount" numeric(12, 2) DEFAULT '0',
	"box_5_amount" numeric(12, 2) DEFAULT '0',
	"box_6_amount" numeric(12, 2) DEFAULT '0',
	"box_7_checked" boolean DEFAULT false,
	"box_8_checked" boolean DEFAULT false,
	"box_9_checked" boolean DEFAULT false,
	"student_ssn_last_4" varchar(4),
	"student_name" varchar(200),
	"student_address" jsonb,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"generated_at" timestamp with time zone,
	"filed_at" timestamp with time zone,
	"is_corrected" boolean DEFAULT false,
	"original_record_id" uuid,
	"correction_reason" text,
	"fire_submission_id" varchar(50),
	"fire_accepted_at" timestamp with time zone,
	"electronic_consent_at" timestamp with time zone,
	"student_accessed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial"."ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"transaction_number" varchar(30),
	"reference_number" varchar(50),
	"entry_type" varchar(20) NOT NULL,
	"charge_code_id" uuid,
	"transaction_date" date NOT NULL,
	"effective_date" date NOT NULL,
	"due_date" date,
	"amount" numeric(12, 2) NOT NULL,
	"term_id" uuid,
	"description" text,
	"tax_year" smallint,
	"is_qtre" boolean DEFAULT false,
	"payment_method" varchar(30),
	"check_number" varchar(20),
	"card_last_4" varchar(4),
	"original_entry_id" uuid,
	"status" varchar(20) DEFAULT 'posted' NOT NULL,
	"posted_by" uuid,
	"batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial"."payment_plan_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_plan_id" uuid NOT NULL,
	"installment_number" smallint NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0',
	"paid_date" date,
	"ledger_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial"."payment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"term_id" uuid,
	"plan_type" varchar(30) NOT NULL,
	"plan_name" varchar(100),
	"total_amount" numeric(12, 2) NOT NULL,
	"down_payment" numeric(12, 2) DEFAULT '0',
	"enrollment_fee" numeric(10, 2) DEFAULT '0',
	"number_of_payments" smallint NOT NULL,
	"payment_amount" numeric(12, 2),
	"start_date" date NOT NULL,
	"end_date" date,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"remaining_balance" numeric(12, 2),
	"missed_payments" smallint DEFAULT 0,
	"agreement_signed_at" timestamp with time zone,
	"agreement_ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial"."refund_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"rule_type" varchar(30) NOT NULL,
	"schedule" jsonb,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial"."third_party_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"term_id" uuid,
	"authorized_amount" numeric(12, 2),
	"used_amount" numeric(12, 2) DEFAULT '0',
	"covers_tuition" boolean DEFAULT true,
	"covers_fees" boolean DEFAULT false,
	"authorization_number" varchar(50),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "financial"."third_party_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"sponsor_name" varchar(200) NOT NULL,
	"sponsor_code" varchar(20),
	"contact_name" varchar(100),
	"contact_email" varchar(255),
	"contact_phone" varchar(20),
	"billing_address" jsonb,
	"effective_from" date,
	"effective_until" date,
	"covers_tuition" boolean DEFAULT true,
	"covers_fees" boolean DEFAULT false,
	"covers_housing" boolean DEFAULT false,
	"covers_meal_plan" boolean DEFAULT false,
	"max_amount" numeric(12, 2),
	"billing_frequency" varchar(20),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aid"."aid_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"award_year_id" uuid NOT NULL,
	"student_program_id" uuid,
	"active_isir_id" uuid,
	"enrollment_status" varchar(20),
	"housing_status" varchar(20),
	"coa_tuition" numeric(10, 2),
	"coa_fees" numeric(10, 2),
	"coa_books" numeric(10, 2),
	"coa_room_board" numeric(10, 2),
	"coa_transportation" numeric(10, 2),
	"coa_personal" numeric(10, 2),
	"coa_other" numeric(10, 2),
	"coa_total" numeric(10, 2),
	"efc" numeric(10, 2),
	"demonstrated_need" numeric(10, 2),
	"total_aid_offered" numeric(10, 2) DEFAULT '0',
	"total_aid_accepted" numeric(10, 2) DEFAULT '0',
	"total_aid_disbursed" numeric(10, 2) DEFAULT '0',
	"remaining_need" numeric(10, 2),
	"remaining_coa" numeric(10, 2),
	"status" varchar(20) DEFAULT 'in_progress' NOT NULL,
	"award_letter_generated_at" timestamp with time zone,
	"award_letter_accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aid"."aid_awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aid_application_id" uuid NOT NULL,
	"fund_id" uuid NOT NULL,
	"offered_amount" numeric(10, 2) NOT NULL,
	"accepted_amount" numeric(10, 2),
	"declined_amount" numeric(10, 2),
	"cancelled_amount" numeric(10, 2),
	"disbursed_amount" numeric(10, 2) DEFAULT '0',
	"status" varchar(20) DEFAULT 'offered' NOT NULL,
	"loan_period_start" date,
	"loan_period_end" date,
	"loan_fee" numeric(10, 2),
	"loan_interest_rate" numeric(5, 4),
	"mpn_completed" boolean,
	"entrance_counseling_completed" boolean,
	"awarded_by" uuid,
	"awarded_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aid"."award_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"isir_file_prefix" varchar(20),
	"pell_maximum" numeric(10, 2),
	"subsidized_loan_limit_freshman" numeric(10, 2),
	"subsidized_loan_limit_sophomore" numeric(10, 2),
	"subsidized_loan_limit_junior_senior" numeric(10, 2),
	"unsubsidized_loan_limit" numeric(10, 2),
	"is_current" boolean DEFAULT false,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aid"."disbursement_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aid_award_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"scheduled_amount" numeric(10, 2) NOT NULL,
	"scheduled_date" date,
	"disbursed_amount" numeric(10, 2),
	"disbursed_date" date,
	"ledger_entry_id" uuid,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"hold_reason" varchar(100),
	"hold_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aid"."fund_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(30) NOT NULL,
	"source" varchar(30) NOT NULL,
	"federal_fund_code" varchar(10),
	"need_based" boolean DEFAULT false,
	"merit_based" boolean DEFAULT false,
	"requires_repayment" boolean DEFAULT false,
	"report_on_1098t" boolean DEFAULT true,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aid"."funds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"fund_type_id" uuid NOT NULL,
	"award_year_id" uuid,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"total_budget" numeric(14, 2),
	"awarded_amount" numeric(14, 2) DEFAULT '0',
	"disbursed_amount" numeric(14, 2) DEFAULT '0',
	"minimum_award" numeric(10, 2),
	"maximum_award" numeric(10, 2),
	"requires_fafsa" boolean DEFAULT true,
	"minimum_gpa" numeric(4, 3),
	"minimum_credits" numeric(4, 2),
	"priority_deadline" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aid"."isir_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"award_year_id" uuid NOT NULL,
	"transaction_number" smallint NOT NULL,
	"isir_received_date" date NOT NULL,
	"efc" numeric(10, 2),
	"sai" numeric(10, 2),
	"pell_eligible" boolean DEFAULT false,
	"pell_lifetime_eligibility_used" numeric(6, 4),
	"dependency_status" varchar(20),
	"verification_selected" boolean DEFAULT false,
	"verification_tracking_group" varchar(10),
	"verification_completed" boolean DEFAULT false,
	"verification_completed_date" date,
	"c_flag_codes" jsonb,
	"comment_codes" jsonb,
	"student_agi" numeric(12, 2),
	"parent_agi" numeric(12, 2),
	"household_size" smallint,
	"number_in_college" smallint,
	"citizenship_status" varchar(20),
	"isir_data" jsonb,
	"is_active" boolean DEFAULT true,
	"status" varchar(20) DEFAULT 'received' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aid"."r2t4_calculations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"withdrawal_date" date NOT NULL,
	"last_date_of_attendance" date,
	"withdrawal_type" varchar(20),
	"payment_period_start" date NOT NULL,
	"payment_period_end" date NOT NULL,
	"calendar_days_in_period" smallint,
	"days_completed" smallint,
	"percentage_completed" numeric(5, 4),
	"earned_percentage" numeric(5, 4),
	"total_title_iv_disbursed" numeric(10, 2),
	"total_title_iv_could_disburse" numeric(10, 2),
	"title_iv_aid_earned" numeric(10, 2),
	"title_iv_aid_to_return" numeric(10, 2),
	"institutional_charges" numeric(10, 2),
	"school_return" numeric(10, 2),
	"student_return" numeric(10, 2),
	"post_withdrawal_disbursement_amount" numeric(10, 2),
	"post_withdrawal_disbursement_offered" boolean,
	"post_withdrawal_disbursement_accepted" boolean,
	"return_details" jsonb,
	"status" varchar(20) DEFAULT 'calculated' NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"return_deadline" date,
	"calculated_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aid"."sap_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"award_year_id" uuid NOT NULL,
	"term_id" uuid,
	"evaluation_date" date NOT NULL,
	"evaluation_type" varchar(20),
	"cumulative_attempted_credits" numeric(8, 2),
	"cumulative_earned_credits" numeric(8, 2),
	"cumulative_gpa" numeric(4, 3),
	"gpa_requirement_met" boolean,
	"minimum_gpa_required" numeric(4, 3),
	"pace_requirement_met" boolean,
	"pace_percentage" numeric(5, 2),
	"minimum_pace_required" numeric(5, 2),
	"max_timeframe_exceeded" boolean,
	"credits_toward_max_timeframe" numeric(8, 2),
	"max_timeframe_credits" numeric(8, 2),
	"sap_status" varchar(30) NOT NULL,
	"previous_sap_status" varchar(30),
	"eligible_for_aid" boolean DEFAULT true,
	"appeal_submitted" boolean DEFAULT false,
	"appeal_date" date,
	"appeal_reason" text,
	"appeal_decision" varchar(20),
	"appeal_decision_date" date,
	"appeal_decision_by" uuid,
	"academic_plan" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."constraint_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"constraint_class" varchar(20) NOT NULL,
	"default_weight" integer,
	"is_enabled" boolean DEFAULT true,
	"parameters" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "constraint_types_institution_id_code_unique" UNIQUE("institution_id","code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."constraint_violations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"solver_run_id" uuid NOT NULL,
	"constraint_type_id" uuid NOT NULL,
	"section_id" uuid,
	"instructor_id" uuid,
	"room_id" uuid,
	"penalty_value" numeric(10, 2),
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."course_room_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"feature_type_id" uuid NOT NULL,
	"minimum_quantity" integer DEFAULT 1,
	"is_required" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_room_requirements_course_id_feature_type_id_unique" UNIQUE("course_id","feature_type_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."cross_list_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"name" varchar(100),
	"control_section_id" uuid,
	"total_capacity" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."date_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"pattern_bits" varchar(500),
	"first_date" date NOT NULL,
	"last_date" date NOT NULL,
	"pattern_type" varchar(20),
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."exam_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_period_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"room_id" uuid,
	"exam_date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_manual_override" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."exam_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"exam_type" varchar(20) NOT NULL,
	"name" varchar(100),
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"default_start_time" time,
	"default_duration_minutes" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."instructor_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_assignment_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'primary' NOT NULL,
	"load_credit" numeric(5, 2),
	"percent_responsibility" integer DEFAULT 100,
	"scheduling_weight" numeric(3, 2) DEFAULT '1.0',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instructor_assignments_section_assignment_id_instructor_id_unique" UNIQUE("section_assignment_id","instructor_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."instructor_attribute_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"is_conjunctive" boolean DEFAULT false,
	"is_required" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instructor_attribute_types_institution_id_code_unique" UNIQUE("institution_id","code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."instructor_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"attribute_type_id" uuid NOT NULL,
	"value" varchar(100),
	"effective_from" date NOT NULL,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."instructor_qualifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"qualification_level" varchar(20) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."instructor_time_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"day_of_week" smallint,
	"start_time" time,
	"end_time" time,
	"meeting_pattern_id" uuid,
	"preference_level" integer DEFAULT 0 NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."instructor_workloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"employment_type" varchar(20),
	"min_load" numeric(5, 2) DEFAULT '0',
	"max_load" numeric(5, 2) NOT NULL,
	"target_load" numeric(5, 2),
	"max_courses" integer,
	"max_preps" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instructor_workloads_instructor_id_term_id_unique" UNIQUE("instructor_id","term_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."meeting_pattern_times" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"break_minutes" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."meeting_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20),
	"total_minutes_per_week" integer NOT NULL,
	"credit_hours_min" numeric(3, 1),
	"credit_hours_max" numeric(3, 1),
	"pattern_type" varchar(20),
	"is_visible" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."preference_levels" (
	"id" integer PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(50) NOT NULL,
	"color" varchar(7),
	"penalty_multiplier" numeric(5, 2),
	CONSTRAINT "preference_levels_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."room_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"term_id" uuid,
	"day_of_week" smallint,
	"start_time" time,
	"end_time" time,
	"availability_type" varchar(20) NOT NULL,
	"department_id" uuid,
	"reason" text,
	"effective_from" date,
	"effective_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."room_feature_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"feature_group" varchar(50),
	"is_quantifiable" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_feature_types_institution_id_code_unique" UNIQUE("institution_id","code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."room_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"feature_type_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_features_room_id_feature_type_id_unique" UNIQUE("room_id","feature_type_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."room_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"owner_type" varchar(20) NOT NULL,
	"room_id" uuid,
	"building_id" uuid,
	"feature_type_id" uuid,
	"preference_level" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."schedule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"name" varchar(100),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"archived_at" timestamp with time zone,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schedule_versions_term_id_version_number_unique" UNIQUE("term_id","version_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."section_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_version_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"meeting_pattern_id" uuid,
	"date_pattern_id" uuid,
	"room_id" uuid,
	"is_manual_override" boolean DEFAULT false,
	"penalty_contribution" numeric(10, 2) DEFAULT '0',
	"assignment_source" varchar(20),
	"notes" text,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"changed_by" uuid,
	"change_reason" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."section_link_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_id" uuid NOT NULL,
	"link_type" varchar(20) NOT NULL,
	"name" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."section_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"link_group_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"link_role" varchar(20) NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "section_links_link_group_id_section_id_unique" UNIQUE("link_group_id","section_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scheduling"."solver_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schedule_version_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"run_type" varchar(20),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"input_sections" integer,
	"assigned_sections" integer,
	"unassigned_sections" integer,
	"total_penalty" numeric(12, 2),
	"solver_config" jsonb,
	"solver_stats" jsonb,
	"error_message" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system"."change_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid,
	"schema_name" varchar(63) NOT NULL,
	"table_name" varchar(63) NOT NULL,
	"record_id" uuid,
	"record_id_text" varchar(100),
	"operation" varchar(10) NOT NULL,
	"old_data" jsonb,
	"new_data" jsonb,
	"changed_fields" jsonb,
	"changed_by" uuid,
	"changed_by_username" varchar(100),
	"session_id" varchar(100),
	"ip_address" varchar(45),
	"user_agent" text,
	"change_reason" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transaction_id" varchar(50)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system"."institution_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"institution_id" uuid NOT NULL,
	"setting_key" varchar(100) NOT NULL,
	"setting_category" varchar(50) NOT NULL,
	"setting_value" jsonb NOT NULL,
	"display_name" varchar(200),
	"description" text,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"changed_by" uuid,
	"change_reason" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system"."tracked_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"schema_name" varchar(63) NOT NULL,
	"table_name" varchar(63) NOT NULL,
	"track_inserts" boolean DEFAULT true,
	"track_updates" boolean DEFAULT true,
	"track_deletes" boolean DEFAULT true,
	"capture_old_data" boolean DEFAULT true,
	"capture_new_data" boolean DEFAULT true,
	"excluded_columns" jsonb,
	"retention_days" integer DEFAULT 2555,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core"."academic_years" ADD CONSTRAINT "academic_years_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core"."buildings" ADD CONSTRAINT "buildings_campus_id_campuses_id_fk" FOREIGN KEY ("campus_id") REFERENCES "core"."campuses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core"."calendar_events" ADD CONSTRAINT "calendar_events_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core"."calendar_events" ADD CONSTRAINT "calendar_events_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core"."campuses" ADD CONSTRAINT "campuses_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core"."rooms" ADD CONSTRAINT "rooms_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "core"."buildings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core"."term_sessions" ADD CONSTRAINT "term_sessions_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core"."term_sessions" ADD CONSTRAINT "term_sessions_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core"."terms" ADD CONSTRAINT "terms_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "core"."terms" ADD CONSTRAINT "terms_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "core"."academic_years"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."audit_logs" ADD CONSTRAINT "audit_logs_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "identity"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "identity"."permissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."roles" ADD CONSTRAINT "roles_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "identity"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."user_roles" ADD CONSTRAINT "user_roles_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity"."users" ADD CONSTRAINT "users_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."academic_standing_appeals" ADD CONSTRAINT "academic_standing_appeals_standing_history_id_academic_standing_history_id_fk" FOREIGN KEY ("standing_history_id") REFERENCES "student"."academic_standing_history"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."academic_standing_appeals" ADD CONSTRAINT "academic_standing_appeals_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."academic_standing_appeals" ADD CONSTRAINT "academic_standing_appeals_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."academic_standing_history" ADD CONSTRAINT "academic_standing_history_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."academic_standing_history" ADD CONSTRAINT "academic_standing_history_student_program_id_student_programs_id_fk" FOREIGN KEY ("student_program_id") REFERENCES "student"."student_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."academic_standing_history" ADD CONSTRAINT "academic_standing_history_policy_id_academic_standing_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "student"."academic_standing_policies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."academic_standing_history" ADD CONSTRAINT "academic_standing_history_determined_by_users_id_fk" FOREIGN KEY ("determined_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."academic_standing_policies" ADD CONSTRAINT "academic_standing_policies_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."cohorts" ADD CONSTRAINT "cohorts_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."student_addresses" ADD CONSTRAINT "student_addresses_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."student_advisors" ADD CONSTRAINT "student_advisors_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."student_advisors" ADD CONSTRAINT "student_advisors_advisor_id_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."student_advisors" ADD CONSTRAINT "student_advisors_student_program_id_student_programs_id_fk" FOREIGN KEY ("student_program_id") REFERENCES "student"."student_programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."student_attributes" ADD CONSTRAINT "student_attributes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."student_cohorts" ADD CONSTRAINT "student_cohorts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."student_gpa_summary" ADD CONSTRAINT "student_gpa_summary_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."student_gpa_summary" ADD CONSTRAINT "student_gpa_summary_student_program_id_student_programs_id_fk" FOREIGN KEY ("student_program_id") REFERENCES "student"."student_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."student_majors" ADD CONSTRAINT "student_majors_student_program_id_student_programs_id_fk" FOREIGN KEY ("student_program_id") REFERENCES "student"."student_programs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."student_notes" ADD CONSTRAINT "student_notes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."student_notes" ADD CONSTRAINT "student_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."student_programs" ADD CONSTRAINT "student_programs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."student_programs" ADD CONSTRAINT "student_programs_campus_id_campuses_id_fk" FOREIGN KEY ("campus_id") REFERENCES "core"."campuses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."students" ADD CONSTRAINT "students_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "student"."students" ADD CONSTRAINT "students_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."catalog_years" ADD CONSTRAINT "catalog_years_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."colleges" ADD CONSTRAINT "colleges_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."colleges" ADD CONSTRAINT "colleges_dean_id_users_id_fk" FOREIGN KEY ("dean_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."course_requisites" ADD CONSTRAINT "course_requisites_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "curriculum"."courses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."course_requisites" ADD CONSTRAINT "course_requisites_requisite_course_id_courses_id_fk" FOREIGN KEY ("requisite_course_id") REFERENCES "curriculum"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."courses" ADD CONSTRAINT "courses_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."courses" ADD CONSTRAINT "courses_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "curriculum"."subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."courses" ADD CONSTRAINT "courses_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "curriculum"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."cross_listed_sections" ADD CONSTRAINT "cross_listed_sections_primary_section_id_sections_id_fk" FOREIGN KEY ("primary_section_id") REFERENCES "curriculum"."sections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."cross_listed_sections" ADD CONSTRAINT "cross_listed_sections_cross_listed_section_id_sections_id_fk" FOREIGN KEY ("cross_listed_section_id") REFERENCES "curriculum"."sections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."degree_types" ADD CONSTRAINT "degree_types_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."departments" ADD CONSTRAINT "departments_college_id_colleges_id_fk" FOREIGN KEY ("college_id") REFERENCES "curriculum"."colleges"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."departments" ADD CONSTRAINT "departments_chair_id_users_id_fk" FOREIGN KEY ("chair_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."grade_scales" ADD CONSTRAINT "grade_scales_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."grades" ADD CONSTRAINT "grades_grade_scale_id_grade_scales_id_fk" FOREIGN KEY ("grade_scale_id") REFERENCES "curriculum"."grade_scales"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."majors" ADD CONSTRAINT "majors_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."majors" ADD CONSTRAINT "majors_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "curriculum"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."program_requirements" ADD CONSTRAINT "program_requirements_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "curriculum"."programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."program_requirements" ADD CONSTRAINT "program_requirements_catalog_year_id_catalog_years_id_fk" FOREIGN KEY ("catalog_year_id") REFERENCES "curriculum"."catalog_years"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."program_requirements" ADD CONSTRAINT "program_requirements_category_id_requirement_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "curriculum"."requirement_categories"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."programs" ADD CONSTRAINT "programs_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."programs" ADD CONSTRAINT "programs_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "curriculum"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."programs" ADD CONSTRAINT "programs_degree_type_id_degree_types_id_fk" FOREIGN KEY ("degree_type_id") REFERENCES "curriculum"."degree_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."requirement_categories" ADD CONSTRAINT "requirement_categories_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."requirement_course_group_courses" ADD CONSTRAINT "requirement_course_group_courses_group_id_requirement_course_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "curriculum"."requirement_course_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."requirement_course_group_courses" ADD CONSTRAINT "requirement_course_group_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "curriculum"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."requirement_course_groups" ADD CONSTRAINT "requirement_course_groups_requirement_id_program_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "curriculum"."program_requirements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."requirement_courses" ADD CONSTRAINT "requirement_courses_requirement_id_program_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "curriculum"."program_requirements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."requirement_courses" ADD CONSTRAINT "requirement_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "curriculum"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."section_instructors" ADD CONSTRAINT "section_instructors_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "curriculum"."sections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."section_instructors" ADD CONSTRAINT "section_instructors_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."section_meetings" ADD CONSTRAINT "section_meetings_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "curriculum"."sections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."section_meetings" ADD CONSTRAINT "section_meetings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "core"."rooms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."sections" ADD CONSTRAINT "sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "curriculum"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."sections" ADD CONSTRAINT "sections_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."sections" ADD CONSTRAINT "sections_campus_id_campuses_id_fk" FOREIGN KEY ("campus_id") REFERENCES "core"."campuses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."sections" ADD CONSTRAINT "sections_primary_instructor_id_users_id_fk" FOREIGN KEY ("primary_instructor_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."student_degree_audits" ADD CONSTRAINT "student_degree_audits_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "curriculum"."programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."student_degree_audits" ADD CONSTRAINT "student_degree_audits_catalog_year_id_catalog_years_id_fk" FOREIGN KEY ("catalog_year_id") REFERENCES "curriculum"."catalog_years"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."subjects" ADD CONSTRAINT "subjects_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "curriculum"."subjects" ADD CONSTRAINT "subjects_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "curriculum"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."attendance_records" ADD CONSTRAINT "attendance_records_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "enrollment"."registrations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."attendance_records" ADD CONSTRAINT "attendance_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."census_snapshot_details" ADD CONSTRAINT "census_snapshot_details_snapshot_id_census_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "enrollment"."census_snapshots"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."census_snapshot_details" ADD CONSTRAINT "census_snapshot_details_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."census_snapshot_details" ADD CONSTRAINT "census_snapshot_details_program_id_student_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "student"."student_programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."census_snapshots" ADD CONSTRAINT "census_snapshots_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."census_snapshots" ADD CONSTRAINT "census_snapshots_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."census_snapshots" ADD CONSTRAINT "census_snapshots_session_id_term_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "core"."term_sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."census_snapshots" ADD CONSTRAINT "census_snapshots_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."hold_types" ADD CONSTRAINT "hold_types_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."hold_types" ADD CONSTRAINT "hold_types_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."priority_groups" ADD CONSTRAINT "priority_groups_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."priority_groups" ADD CONSTRAINT "priority_groups_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registration_appointments" ADD CONSTRAINT "registration_appointments_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registration_appointments" ADD CONSTRAINT "registration_appointments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registration_appointments" ADD CONSTRAINT "registration_appointments_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registration_appointments" ADD CONSTRAINT "registration_appointments_priority_group_id_priority_groups_id_fk" FOREIGN KEY ("priority_group_id") REFERENCES "enrollment"."priority_groups"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registration_appointments" ADD CONSTRAINT "registration_appointments_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registration_change_logs" ADD CONSTRAINT "registration_change_logs_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "enrollment"."registrations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registration_change_logs" ADD CONSTRAINT "registration_change_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registration_holds" ADD CONSTRAINT "registration_holds_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registration_holds" ADD CONSTRAINT "registration_holds_hold_type_id_hold_types_id_fk" FOREIGN KEY ("hold_type_id") REFERENCES "enrollment"."hold_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registration_holds" ADD CONSTRAINT "registration_holds_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registration_holds" ADD CONSTRAINT "registration_holds_placed_by_users_id_fk" FOREIGN KEY ("placed_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registrations" ADD CONSTRAINT "registrations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registrations" ADD CONSTRAINT "registrations_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "curriculum"."sections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registrations" ADD CONSTRAINT "registrations_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registrations" ADD CONSTRAINT "registrations_grade_id_grades_id_fk" FOREIGN KEY ("grade_id") REFERENCES "curriculum"."grades"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registrations" ADD CONSTRAINT "registrations_midterm_grade_id_grades_id_fk" FOREIGN KEY ("midterm_grade_id") REFERENCES "curriculum"."grades"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."registrations" ADD CONSTRAINT "registrations_override_by_users_id_fk" FOREIGN KEY ("override_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."term_enrollments" ADD CONSTRAINT "term_enrollments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."term_enrollments" ADD CONSTRAINT "term_enrollments_student_program_id_student_programs_id_fk" FOREIGN KEY ("student_program_id") REFERENCES "student"."student_programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."term_enrollments" ADD CONSTRAINT "term_enrollments_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."test_scores" ADD CONSTRAINT "test_scores_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."test_scores" ADD CONSTRAINT "test_scores_equivalent_course_id_courses_id_fk" FOREIGN KEY ("equivalent_course_id") REFERENCES "curriculum"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."transfer_credits" ADD CONSTRAINT "transfer_credits_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."transfer_credits" ADD CONSTRAINT "transfer_credits_equivalent_course_id_courses_id_fk" FOREIGN KEY ("equivalent_course_id") REFERENCES "curriculum"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."transfer_credits" ADD CONSTRAINT "transfer_credits_evaluated_by_users_id_fk" FOREIGN KEY ("evaluated_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."waitlist_entries" ADD CONSTRAINT "waitlist_entries_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment"."waitlist_entries" ADD CONSTRAINT "waitlist_entries_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "curriculum"."sections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."accounts" ADD CONSTRAINT "accounts_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."accounts" ADD CONSTRAINT "accounts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."charge_codes" ADD CONSTRAINT "charge_codes_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."financial_holds" ADD CONSTRAINT "financial_holds_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "financial"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."financial_holds" ADD CONSTRAINT "financial_holds_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."form_1098t_records" ADD CONSTRAINT "form_1098t_records_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."form_1098t_records" ADD CONSTRAINT "form_1098t_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "financial"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."ledger_entries" ADD CONSTRAINT "ledger_entries_charge_code_id_charge_codes_id_fk" FOREIGN KEY ("charge_code_id") REFERENCES "financial"."charge_codes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."ledger_entries" ADD CONSTRAINT "ledger_entries_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."ledger_entries" ADD CONSTRAINT "ledger_entries_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."payment_plan_installments" ADD CONSTRAINT "payment_plan_installments_payment_plan_id_payment_plans_id_fk" FOREIGN KEY ("payment_plan_id") REFERENCES "financial"."payment_plans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."payment_plan_installments" ADD CONSTRAINT "payment_plan_installments_ledger_entry_id_ledger_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "financial"."ledger_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."payment_plans" ADD CONSTRAINT "payment_plans_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "financial"."accounts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."payment_plans" ADD CONSTRAINT "payment_plans_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."refund_rules" ADD CONSTRAINT "refund_rules_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."third_party_authorizations" ADD CONSTRAINT "third_party_authorizations_contract_id_third_party_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "financial"."third_party_contracts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."third_party_authorizations" ADD CONSTRAINT "third_party_authorizations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."third_party_authorizations" ADD CONSTRAINT "third_party_authorizations_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "financial"."third_party_contracts" ADD CONSTRAINT "third_party_contracts_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."aid_applications" ADD CONSTRAINT "aid_applications_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."aid_applications" ADD CONSTRAINT "aid_applications_award_year_id_award_years_id_fk" FOREIGN KEY ("award_year_id") REFERENCES "aid"."award_years"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."aid_applications" ADD CONSTRAINT "aid_applications_student_program_id_student_programs_id_fk" FOREIGN KEY ("student_program_id") REFERENCES "student"."student_programs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."aid_applications" ADD CONSTRAINT "aid_applications_active_isir_id_isir_records_id_fk" FOREIGN KEY ("active_isir_id") REFERENCES "aid"."isir_records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."aid_awards" ADD CONSTRAINT "aid_awards_aid_application_id_aid_applications_id_fk" FOREIGN KEY ("aid_application_id") REFERENCES "aid"."aid_applications"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."aid_awards" ADD CONSTRAINT "aid_awards_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "aid"."funds"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."aid_awards" ADD CONSTRAINT "aid_awards_awarded_by_users_id_fk" FOREIGN KEY ("awarded_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."award_years" ADD CONSTRAINT "award_years_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."disbursement_schedules" ADD CONSTRAINT "disbursement_schedules_aid_award_id_aid_awards_id_fk" FOREIGN KEY ("aid_award_id") REFERENCES "aid"."aid_awards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."disbursement_schedules" ADD CONSTRAINT "disbursement_schedules_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."disbursement_schedules" ADD CONSTRAINT "disbursement_schedules_ledger_entry_id_ledger_entries_id_fk" FOREIGN KEY ("ledger_entry_id") REFERENCES "financial"."ledger_entries"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."fund_types" ADD CONSTRAINT "fund_types_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."funds" ADD CONSTRAINT "funds_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."funds" ADD CONSTRAINT "funds_fund_type_id_fund_types_id_fk" FOREIGN KEY ("fund_type_id") REFERENCES "aid"."fund_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."funds" ADD CONSTRAINT "funds_award_year_id_award_years_id_fk" FOREIGN KEY ("award_year_id") REFERENCES "aid"."award_years"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."isir_records" ADD CONSTRAINT "isir_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."isir_records" ADD CONSTRAINT "isir_records_award_year_id_award_years_id_fk" FOREIGN KEY ("award_year_id") REFERENCES "aid"."award_years"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."r2t4_calculations" ADD CONSTRAINT "r2t4_calculations_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."r2t4_calculations" ADD CONSTRAINT "r2t4_calculations_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."r2t4_calculations" ADD CONSTRAINT "r2t4_calculations_calculated_by_users_id_fk" FOREIGN KEY ("calculated_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."sap_records" ADD CONSTRAINT "sap_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "student"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."sap_records" ADD CONSTRAINT "sap_records_award_year_id_award_years_id_fk" FOREIGN KEY ("award_year_id") REFERENCES "aid"."award_years"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."sap_records" ADD CONSTRAINT "sap_records_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aid"."sap_records" ADD CONSTRAINT "sap_records_appeal_decision_by_users_id_fk" FOREIGN KEY ("appeal_decision_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."constraint_types" ADD CONSTRAINT "constraint_types_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."constraint_violations" ADD CONSTRAINT "constraint_violations_solver_run_id_solver_runs_id_fk" FOREIGN KEY ("solver_run_id") REFERENCES "scheduling"."solver_runs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."constraint_violations" ADD CONSTRAINT "constraint_violations_constraint_type_id_constraint_types_id_fk" FOREIGN KEY ("constraint_type_id") REFERENCES "scheduling"."constraint_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."constraint_violations" ADD CONSTRAINT "constraint_violations_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "curriculum"."sections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."constraint_violations" ADD CONSTRAINT "constraint_violations_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."constraint_violations" ADD CONSTRAINT "constraint_violations_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "core"."rooms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."course_room_requirements" ADD CONSTRAINT "course_room_requirements_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "curriculum"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."course_room_requirements" ADD CONSTRAINT "course_room_requirements_feature_type_id_room_feature_types_id_fk" FOREIGN KEY ("feature_type_id") REFERENCES "scheduling"."room_feature_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."cross_list_groups" ADD CONSTRAINT "cross_list_groups_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."cross_list_groups" ADD CONSTRAINT "cross_list_groups_control_section_id_sections_id_fk" FOREIGN KEY ("control_section_id") REFERENCES "curriculum"."sections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."date_patterns" ADD CONSTRAINT "date_patterns_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."exam_assignments" ADD CONSTRAINT "exam_assignments_exam_period_id_exam_periods_id_fk" FOREIGN KEY ("exam_period_id") REFERENCES "scheduling"."exam_periods"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."exam_assignments" ADD CONSTRAINT "exam_assignments_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "curriculum"."sections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."exam_assignments" ADD CONSTRAINT "exam_assignments_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "core"."rooms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."exam_periods" ADD CONSTRAINT "exam_periods_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."instructor_assignments" ADD CONSTRAINT "instructor_assignments_section_assignment_id_section_assignments_id_fk" FOREIGN KEY ("section_assignment_id") REFERENCES "scheduling"."section_assignments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."instructor_assignments" ADD CONSTRAINT "instructor_assignments_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."instructor_attribute_types" ADD CONSTRAINT "instructor_attribute_types_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."instructor_attributes" ADD CONSTRAINT "instructor_attributes_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."instructor_attributes" ADD CONSTRAINT "instructor_attributes_attribute_type_id_instructor_attribute_types_id_fk" FOREIGN KEY ("attribute_type_id") REFERENCES "scheduling"."instructor_attribute_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."instructor_qualifications" ADD CONSTRAINT "instructor_qualifications_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."instructor_qualifications" ADD CONSTRAINT "instructor_qualifications_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "curriculum"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."instructor_qualifications" ADD CONSTRAINT "instructor_qualifications_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."instructor_time_preferences" ADD CONSTRAINT "instructor_time_preferences_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."instructor_time_preferences" ADD CONSTRAINT "instructor_time_preferences_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."instructor_time_preferences" ADD CONSTRAINT "instructor_time_preferences_meeting_pattern_id_meeting_patterns_id_fk" FOREIGN KEY ("meeting_pattern_id") REFERENCES "scheduling"."meeting_patterns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."instructor_workloads" ADD CONSTRAINT "instructor_workloads_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."instructor_workloads" ADD CONSTRAINT "instructor_workloads_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."meeting_pattern_times" ADD CONSTRAINT "meeting_pattern_times_pattern_id_meeting_patterns_id_fk" FOREIGN KEY ("pattern_id") REFERENCES "scheduling"."meeting_patterns"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."meeting_patterns" ADD CONSTRAINT "meeting_patterns_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."room_availability" ADD CONSTRAINT "room_availability_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "core"."rooms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."room_availability" ADD CONSTRAINT "room_availability_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."room_availability" ADD CONSTRAINT "room_availability_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "curriculum"."departments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."room_feature_types" ADD CONSTRAINT "room_feature_types_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."room_features" ADD CONSTRAINT "room_features_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "core"."rooms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."room_features" ADD CONSTRAINT "room_features_feature_type_id_room_feature_types_id_fk" FOREIGN KEY ("feature_type_id") REFERENCES "scheduling"."room_feature_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."room_preferences" ADD CONSTRAINT "room_preferences_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "core"."rooms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."room_preferences" ADD CONSTRAINT "room_preferences_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "core"."buildings"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."room_preferences" ADD CONSTRAINT "room_preferences_feature_type_id_room_feature_types_id_fk" FOREIGN KEY ("feature_type_id") REFERENCES "scheduling"."room_feature_types"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."schedule_versions" ADD CONSTRAINT "schedule_versions_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."schedule_versions" ADD CONSTRAINT "schedule_versions_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."schedule_versions" ADD CONSTRAINT "schedule_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."schedule_versions" ADD CONSTRAINT "schedule_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."section_assignments" ADD CONSTRAINT "section_assignments_schedule_version_id_schedule_versions_id_fk" FOREIGN KEY ("schedule_version_id") REFERENCES "scheduling"."schedule_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."section_assignments" ADD CONSTRAINT "section_assignments_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "curriculum"."sections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."section_assignments" ADD CONSTRAINT "section_assignments_meeting_pattern_id_meeting_patterns_id_fk" FOREIGN KEY ("meeting_pattern_id") REFERENCES "scheduling"."meeting_patterns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."section_assignments" ADD CONSTRAINT "section_assignments_date_pattern_id_date_patterns_id_fk" FOREIGN KEY ("date_pattern_id") REFERENCES "scheduling"."date_patterns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."section_assignments" ADD CONSTRAINT "section_assignments_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "core"."rooms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."section_assignments" ADD CONSTRAINT "section_assignments_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."section_link_groups" ADD CONSTRAINT "section_link_groups_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "core"."terms"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."section_links" ADD CONSTRAINT "section_links_link_group_id_section_link_groups_id_fk" FOREIGN KEY ("link_group_id") REFERENCES "scheduling"."section_link_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."section_links" ADD CONSTRAINT "section_links_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "curriculum"."sections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."solver_runs" ADD CONSTRAINT "solver_runs_schedule_version_id_schedule_versions_id_fk" FOREIGN KEY ("schedule_version_id") REFERENCES "scheduling"."schedule_versions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scheduling"."solver_runs" ADD CONSTRAINT "solver_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system"."change_log" ADD CONSTRAINT "change_log_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system"."change_log" ADD CONSTRAINT "change_log_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system"."institution_settings" ADD CONSTRAINT "institution_settings_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "core"."institutions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system"."institution_settings" ADD CONSTRAINT "institution_settings_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "identity"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_idx" ON "identity"."audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_student_idx" ON "identity"."audit_logs" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_resource_idx" ON "identity"."audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "identity"."audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_institution_created_idx" ON "identity"."audit_logs" USING btree ("institution_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_provider_account_idx" ON "identity"."oauth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_token_idx" ON "identity"."sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_expires_idx" ON "identity"."sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_roles_user_idx" ON "identity"."user_roles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_email_institution_idx" ON "identity"."users" USING btree ("email","institution_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_external_id_idx" ON "identity"."users" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_standing_appeals_standing_history_idx" ON "student"."academic_standing_appeals" USING btree ("standing_history_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_standing_appeals_student_idx" ON "student"."academic_standing_appeals" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_standing_appeals_status_idx" ON "student"."academic_standing_appeals" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_standing_history_student_idx" ON "student"."academic_standing_history" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_standing_history_term_idx" ON "student"."academic_standing_history" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_standing_history_student_term_idx" ON "student"."academic_standing_history" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_standing_history_standing_idx" ON "student"."academic_standing_history" USING btree ("standing");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_standing_policies_institution_idx" ON "student"."academic_standing_policies" USING btree ("institution_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_standing_policies_code_idx" ON "student"."academic_standing_policies" USING btree ("institution_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_addresses_student_type_idx" ON "student"."student_addresses" USING btree ("student_id","address_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_advisors_student_idx" ON "student"."student_advisors" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_advisors_advisor_idx" ON "student"."student_advisors" USING btree ("advisor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_attributes_student_attribute_idx" ON "student"."student_attributes" USING btree ("student_id","attribute_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_gpa_summary_student_idx" ON "student"."student_gpa_summary" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_gpa_summary_student_program_idx" ON "student"."student_gpa_summary" USING btree ("student_program_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_notes_student_idx" ON "student"."student_notes" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_notes_type_idx" ON "student"."student_notes" USING btree ("note_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_programs_student_idx" ON "student"."student_programs" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_programs_program_idx" ON "student"."student_programs" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_programs_status_idx" ON "student"."student_programs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_student_id_institution_idx" ON "student"."students" USING btree ("student_id","institution_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_email_idx" ON "student"."students" USING btree ("primary_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_user_idx" ON "student"."students" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_name_idx" ON "student"."students" USING btree ("legal_last_name","legal_first_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courses_course_code_idx" ON "curriculum"."courses" USING btree ("course_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "courses_subject_number_idx" ON "curriculum"."courses" USING btree ("subject_id","course_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "program_requirements_program_catalog_idx" ON "curriculum"."program_requirements" USING btree ("program_id","catalog_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "program_requirements_category_idx" ON "curriculum"."program_requirements" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "programs_code_idx" ON "curriculum"."programs" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "programs_cip_idx" ON "curriculum"."programs" USING btree ("cip_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requirement_categories_institution_code_idx" ON "curriculum"."requirement_categories" USING btree ("institution_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requirement_course_group_courses_group_course_idx" ON "curriculum"."requirement_course_group_courses" USING btree ("group_id","course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "requirement_courses_requirement_course_idx" ON "curriculum"."requirement_courses" USING btree ("requirement_id","course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sections_course_term_idx" ON "curriculum"."sections" USING btree ("course_id","term_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sections_crn_idx" ON "curriculum"."sections" USING btree ("crn");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sections_instructor_idx" ON "curriculum"."sections" USING btree ("primary_instructor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sections_term_status_idx" ON "curriculum"."sections" USING btree ("term_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_degree_audits_student_program_idx" ON "curriculum"."student_degree_audits" USING btree ("student_id","student_program_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_degree_audits_audit_date_idx" ON "curriculum"."student_degree_audits" USING btree ("audit_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_records_registration_date_idx" ON "enrollment"."attendance_records" USING btree ("registration_id","class_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "census_snapshot_details_snapshot_student_idx" ON "enrollment"."census_snapshot_details" USING btree ("snapshot_id","student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "census_snapshot_details_student_idx" ON "enrollment"."census_snapshot_details" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "census_snapshot_details_enrollment_type_idx" ON "enrollment"."census_snapshot_details" USING btree ("snapshot_id","enrollment_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "census_snapshot_details_level_idx" ON "enrollment"."census_snapshot_details" USING btree ("snapshot_id","level");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "census_snapshots_term_date_idx" ON "enrollment"."census_snapshots" USING btree ("term_id","snapshot_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "census_snapshots_session_idx" ON "enrollment"."census_snapshots" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hold_types_institution_code_idx" ON "enrollment"."hold_types" USING btree ("institution_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hold_types_category_idx" ON "enrollment"."hold_types" USING btree ("institution_id","category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hold_types_current_idx" ON "enrollment"."hold_types" USING btree ("institution_id") WHERE valid_to IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "priority_groups_institution_code_idx" ON "enrollment"."priority_groups" USING btree ("institution_id","code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "priority_groups_priority_level_idx" ON "enrollment"."priority_groups" USING btree ("institution_id","priority_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "priority_groups_current_idx" ON "enrollment"."priority_groups" USING btree ("institution_id") WHERE valid_to IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "registration_appointments_student_term_idx" ON "enrollment"."registration_appointments" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_appointments_term_appointment_idx" ON "enrollment"."registration_appointments" USING btree ("term_id","appointment_start");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_appointments_priority_group_idx" ON "enrollment"."registration_appointments" USING btree ("priority_group_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_change_logs_registration_idx" ON "enrollment"."registration_change_logs" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_change_logs_created_at_idx" ON "enrollment"."registration_change_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_holds_student_idx" ON "enrollment"."registration_holds" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_holds_student_active_idx" ON "enrollment"."registration_holds" USING btree ("student_id","resolved_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registration_holds_hold_type_idx" ON "enrollment"."registration_holds" USING btree ("hold_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "registrations_student_section_idx" ON "enrollment"."registrations" USING btree ("student_id","section_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registrations_student_term_idx" ON "enrollment"."registrations" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registrations_section_idx" ON "enrollment"."registrations" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registrations_term_status_idx" ON "enrollment"."registrations" USING btree ("term_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "registrations_grade_idx" ON "enrollment"."registrations" USING btree ("grade_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "term_enrollments_student_term_idx" ON "enrollment"."term_enrollments" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "term_enrollments_term_status_idx" ON "enrollment"."term_enrollments" USING btree ("term_id","enrollment_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "test_scores_student_test_idx" ON "enrollment"."test_scores" USING btree ("student_id","test_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfer_credits_student_idx" ON "enrollment"."transfer_credits" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_entries_section_position_idx" ON "enrollment"."waitlist_entries" USING btree ("section_id","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "waitlist_entries_student_idx" ON "enrollment"."waitlist_entries" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_student_idx" ON "financial"."accounts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_account_number_idx" ON "financial"."accounts" USING btree ("account_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "financial_holds_account_idx" ON "financial"."financial_holds" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_1098t_records_student_tax_year_idx" ON "financial"."form_1098t_records" USING btree ("student_id","tax_year");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "form_1098t_records_tax_year_status_idx" ON "financial"."form_1098t_records" USING btree ("tax_year","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_account_idx" ON "financial"."ledger_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_transaction_date_idx" ON "financial"."ledger_entries" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_term_idx" ON "financial"."ledger_entries" USING btree ("term_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_tax_year_qtre_idx" ON "financial"."ledger_entries" USING btree ("tax_year","is_qtre");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ledger_entries_status_idx" ON "financial"."ledger_entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_plans_account_idx" ON "financial"."payment_plans" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "third_party_authorizations_student_idx" ON "financial"."third_party_authorizations" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "third_party_authorizations_contract_idx" ON "financial"."third_party_authorizations" USING btree ("contract_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aid_applications_student_year_idx" ON "aid"."aid_applications" USING btree ("student_id","award_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aid_awards_application_idx" ON "aid"."aid_awards" USING btree ("aid_application_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aid_awards_fund_idx" ON "aid"."aid_awards" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aid_awards_status_idx" ON "aid"."aid_awards" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disbursement_schedules_award_term_idx" ON "aid"."disbursement_schedules" USING btree ("aid_award_id","term_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "isir_records_student_year_idx" ON "aid"."isir_records" USING btree ("student_id","award_year_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "isir_records_transaction_idx" ON "aid"."isir_records" USING btree ("student_id","award_year_id","transaction_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "r2t4_calculations_student_term_idx" ON "aid"."r2t4_calculations" USING btree ("student_id","term_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "r2t4_calculations_status_idx" ON "aid"."r2t4_calculations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sap_records_student_year_idx" ON "aid"."sap_records" USING btree ("student_id","award_year_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sap_records_status_idx" ON "aid"."sap_records" USING btree ("sap_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "instructor_qualifications_instructor_course_idx" ON "scheduling"."instructor_qualifications" USING btree ("instructor_id","course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "instructor_time_preferences_instructor_term_idx" ON "scheduling"."instructor_time_preferences" USING btree ("instructor_id","term_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_versions_published_idx" ON "scheduling"."schedule_versions" USING btree ("term_id","status") WHERE status = 'published';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section_assignments_version_section_idx" ON "scheduling"."section_assignments" USING btree ("schedule_version_id","section_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "section_assignments_current_idx" ON "scheduling"."section_assignments" USING btree ("section_id") WHERE valid_to IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_log_table_record_idx" ON "system"."change_log" USING btree ("schema_name","table_name","record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_log_institution_time_idx" ON "system"."change_log" USING btree ("institution_id","changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_log_user_time_idx" ON "system"."change_log" USING btree ("changed_by","changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_log_transaction_idx" ON "system"."change_log" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_log_changed_at_idx" ON "system"."change_log" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "institution_settings_institution_key_idx" ON "system"."institution_settings" USING btree ("institution_id","setting_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "institution_settings_category_idx" ON "system"."institution_settings" USING btree ("institution_id","setting_category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "institution_settings_current_idx" ON "system"."institution_settings" USING btree ("institution_id","setting_key") WHERE valid_to IS NULL;