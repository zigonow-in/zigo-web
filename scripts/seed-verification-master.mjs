import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

const documentTypes = [
  { code: "profile_photo", name: "Profile Photo", entityType: "user", description: "Clear profile photograph" },
  { code: "aadhaar_card", name: "Aadhaar Card", entityType: "person", description: "Government identity proof" },
  { code: "pan_card", name: "PAN Card", entityType: "person", description: "PAN identity proof" },
  { code: "driving_license", name: "Driving License", entityType: "assistant", description: "Valid rider driving license" },
  { code: "police_verification", name: "Police Verification", entityType: "assistant", description: "Background or police verification document" },
  { code: "vehicle_rc", name: "Vehicle RC", entityType: "vehicle", description: "Vehicle registration certificate" },
  { code: "vehicle_insurance", name: "Vehicle Insurance", entityType: "vehicle", description: "Active vehicle insurance" },
  { code: "vehicle_puc", name: "Vehicle PUC", entityType: "vehicle", description: "Pollution certificate" },
  { code: "vehicle_photo", name: "Vehicle Photo", entityType: "vehicle", description: "Vehicle image for visual verification" }
];

const roleRequirements = {
  assistant: [
    "profile_photo",
    "aadhaar_card",
    "pan_card",
    "driving_license",
    "police_verification",
    "vehicle_rc",
    "vehicle_insurance",
    "vehicle_puc",
    "vehicle_photo"
  ],
  customer: ["profile_photo"],
  staff: ["profile_photo", "aadhaar_card"],
  manager: ["profile_photo", "aadhaar_card", "pan_card"],
  admin: ["profile_photo", "aadhaar_card", "pan_card"]
};

const client = await pool.connect();

try {
  await client.query("begin");

  const documentTypeIds = new Map();
  for (const type of documentTypes) {
    const result = await client.query(
      `
        insert into zigo.document_types (code, name, entity_type, description, is_active)
        values ($1, $2, $3, $4, true)
        on conflict (code) do update
          set name = excluded.name,
              entity_type = excluded.entity_type,
              description = excluded.description,
              is_active = true,
              updated_at = now()
        returning id
      `,
      [type.code, type.name, type.entityType, type.description]
    );
    documentTypeIds.set(type.code, result.rows[0].id);
  }

  for (const [roleCode, requiredDocuments] of Object.entries(roleRequirements)) {
    const role = await client.query("select id from zigo.roles where code = $1", [roleCode]);
    if (!role.rows[0]) continue;

    for (const documentCode of requiredDocuments) {
      await client.query(
        `
          insert into zigo.role_verification_requirements (role_id, document_type_id, is_required)
          values ($1, $2, true)
          on conflict (role_id, document_type_id) do update
            set is_required = true
        `,
        [role.rows[0].id, documentTypeIds.get(documentCode)]
      );
    }
  }

  await client.query("commit");
  console.log("Verification master seed completed.");
  console.table([{ documentTypes: documentTypes.length, rolesConfigured: Object.keys(roleRequirements).length }]);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
