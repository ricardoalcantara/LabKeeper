CREATE TABLE host_types (
   id SERIAL PRIMARY KEY,
   name VARCHAR(50)
);


CREATE TABLE host_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50)
);


CREATE TABLE hosts (
   id SERIAL PRIMARY KEY,
   hostname VARCHAR(255),
   host_type_id INTEGER REFERENCES host_types(id),
   host_status_id INTEGER REFERENCES host_statuses(id),
   description TEXT,
   status VARCHAR(50),
   created_at TIMESTAMP,
   updated_at TIMESTAMP,
   deleted_at TIMESTAMP
);

CREATE TABLE ip_addresses (
   id SERIAL PRIMARY KEY,
   host_id INTEGER REFERENCES hosts(id),
   address VARCHAR(45),
   cidr_mask INTEGER,
   mac_address VARCHAR(17)
);

CREATE TABLE services (
   id SERIAL PRIMARY KEY,
   host_id INTEGER REFERENCES hosts(id),
   port INTEGER,
   protocol VARCHAR(10),
   service_name VARCHAR(100)
);

CREATE TABLE service_ip_addresses (
   service_id INTEGER REFERENCES services(id),
   ip_address_id INTEGER REFERENCES ip_addresses(id),
   PRIMARY KEY (service_id, ip_address_id)
);