CREATE TABLE public.users (
	username varchar NOT NULL,
	user_id varchar(128) NULL,
	"password" varchar(256) NULL,
	CONSTRAINT users_pk PRIMARY KEY (username)
);
CREATE UNIQUE INDEX users_user_id_idx ON public.users (user_id);

CREATE TABLE public.users (
	username varchar NOT NULL,
	user_id varchar(128) NULL,
	"password" varchar(256) NULL,
	CONSTRAINT users_pk PRIMARY KEY (username)
);
CREATE UNIQUE INDEX users_user_id_idx ON public.users (user_id);
