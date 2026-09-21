import {
  createRemoteJWKSet,
  importPKCS8,
  jwtVerify,
  SignJWT,
} from "npm:jose@6";

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "";

const FIREBASE_SERVICE_ACCOUNT_JSON =
  Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") || "";

if (!FIREBASE_PROJECT_ID) {
  throw new Error("Missing FIREBASE_PROJECT_ID");
}

if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
}

const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);

const firebaseJWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("Authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

async function verifyFirebaseUser(token: string) {
  const issuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

  const { payload } = await jwtVerify(token, firebaseJWKS, {
    issuer,
    audience: FIREBASE_PROJECT_ID,
  });

  if (!payload.sub) {
    throw new Error("Firebase token has no subject");
  }

  return payload.sub;
}

async function getGoogleAccessToken() {
  const privateKey = await importPKCS8(serviceAccount.private_key, "RS256");

  const now = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/datastore",
  })
    .setProtectedHeader({
      alg: "RS256",
      typ: "JWT",
    })
    .setIssuer(serviceAccount.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to obtain Firestore service access token");
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Firestore service access token was not returned");
  }

  return data.access_token as string;
}

function firestoreBaseUrl() {
  return (
    "https://firestore.googleapis.com/v1/projects/" +
    `${encodeURIComponent(FIREBASE_PROJECT_ID)}` +
    "/databases/(default)/documents"
  );
}

async function firestoreGet(path: string, accessToken: string) {
  const response = await fetch(`${firestoreBaseUrl()}/${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Firestore GET failed: ${response.status}`);
  }

  return await response.json();
}

async function firestoreCommit(writes: unknown[], accessToken: string) {
  const response = await fetch(`${firestoreBaseUrl()}:commit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ writes }),
  });

  if (!response.ok) {
    const text = await response.text();

    console.error("Firestore commit failed:", text);

    throw new Error("Unable to complete BOGO claim");
  }

  return await response.json();
}

function stringField(document: any, field: string) {
  return document?.fields?.[field]?.stringValue ?? "";
}

function integerField(document: any, field: string) {
  return Number(document?.fields?.[field]?.integerValue ?? 0);
}

function booleanField(document: any, field: string) {
  return document?.fields?.[field]?.booleanValue === true;
}

function firestoreResource(collection: string, id: string) {
  return (
    `projects/${FIREBASE_PROJECT_ID}` +
    `/databases/(default)/documents/` +
    `${collection}/${encodeURIComponent(id)}`
  );
}

function isSafeId(value: string) {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function firestoreValue(value: any): any {
  if (!value || typeof value !== "object") return null;

  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;

  if ("mapValue" in value) {
    const fields = value.mapValue?.fields ?? {};
    const result: Record<string, any> = {};
    for (const [key, fieldValue] of Object.entries(fields)) {
      result[key] = firestoreValue(fieldValue);
    }
    return result;
  }

  if ("arrayValue" in value) {
    return (value.arrayValue?.values ?? []).map((item: any) =>
      firestoreValue(item),
    );
  }

  return null;
}

function firestoreDocumentData(document: any): Record<string, any> {
  const fields = document?.fields ?? {};
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(fields)) {
    result[key] = firestoreValue(value);
  }

  return result;
}

function getRegularPrice(course: any, pricing: any) {
  const data = firestoreDocumentData(course);

  if (data.is_free) return 0;

  const pricingMode = data.pricing_mode;

  if (data.is_competition) {
    const categoryId = data.category_id;
    const name = data.name;

    if (categoryId && name) {
      const key = `${categoryId}:${name}`;
      const plan = pricing?.catalogCourses?.plans?.[key];

      if (plan && Number(plan.regularPrice) > 0) {
        return Number(plan.regularPrice);
      }
    }

    return Math.max(Number(data.base_fee) || 0, 0);
  }

  if (pricingMode === "special_offer") {
    const key = data.special_offer_key || "phonics";
    const offer = pricing?.specialOffers?.[key];

    if (offer && Number(offer.regularPrice) > 0) {
      return Number(offer.regularPrice);
    }
  }

  if (pricingMode === "school_tuition") {
    const board = data.tuition_board;
    const session = data.tuition_session;
    const classBand = data.tuition_class_band;

    if (board && session && classBand) {
      const planKey = `${board}_${session}_${classBand}`;
      const plan = pricing?.schoolTuition?.plans?.[planKey];

      if (plan && Number(plan.regularPrice) > 0) {
        return Number(plan.regularPrice);
      }
    }
  }

  if (pricingMode === "one_to_one") {
    return Math.max(
      Number(data.monthly_fee_override ?? pricing?.oneToOneMonthlyFee) || 0,
      0,
    );
  }

  if (pricingMode === "monthly_group") {
    return Math.max(
      Number(data.monthly_fee_override ?? pricing?.monthlyGroupFeePerStudent) ||
        0,
      0,
    );
  }

  if (pricingMode === "legacy") {
    return Math.max(Number(data.base_fee) || 0, 0);
  }

  return Math.max(
    Number(data.monthly_fee_override ?? pricing?.monthlyGroupFeePerStudent) ||
      0,
    0,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const firebaseToken = getBearerToken(req);

    if (!firebaseToken) {
      return json({ error: "Authentication required" }, 401);
    }

    const studentId = await verifyFirebaseUser(firebaseToken);

    const body = await req.json();

    const entitlementId = String(body.entitlementId || "").trim();

    const targetCourseId = String(body.targetCourseId || "").trim();

    if (
      !entitlementId ||
      !isSafeId(entitlementId) ||
      !targetCourseId ||
      !isSafeId(targetCourseId)
    ) {
      return json(
        {
          error: "Valid entitlementId and targetCourseId are required",
        },
        400,
      );
    }

    const accessToken = await getGoogleAccessToken();

    const pricingDocument = await firestoreGet("settings/pricing", accessToken);

    if (!pricingDocument?.fields) {
      return json({ error: "Pricing configuration is not available" }, 503);
    }

    const pricingConfig = firestoreDocumentData(pricingDocument);

    const entitlement = await firestoreGet(
      `bogo_entitlements/${encodeURIComponent(entitlementId)}`,
      accessToken,
    );

    if (!entitlement?.fields) {
      return json({ error: "BOGO entitlement not found" }, 404);
    }

    const entitlementUpdateTime = entitlement.updateTime;

    if (!entitlementUpdateTime) {
      return json({ error: "Invalid BOGO entitlement state" }, 409);
    }

    if (
      stringField(entitlement, "studentId") !== studentId &&
      stringField(entitlement, "student_id") !== studentId
    ) {
      return json(
        { error: "This BOGO entitlement does not belong to you" },
        403,
      );
    }

    if (booleanField(entitlement, "claimed")) {
      return json(
        { error: "This BOGO entitlement has already been claimed" },
        409,
      );
    }

    const eligibleUntil =
      stringField(entitlement, "eligibleUntil") ||
      stringField(entitlement, "eligible_until");

    if (!eligibleUntil || Date.now() > new Date(eligibleUntil).getTime()) {
      return json({ error: "This BOGO offer has expired" }, 409);
    }

    const purchasedCourseId =
      stringField(entitlement, "purchasedCourseId") ||
      stringField(entitlement, "purchased_course_id");

    const purchasedRegularPrice =
      integerField(entitlement, "purchasedRegularPrice") ||
      integerField(entitlement, "purchased_regular_price");

    const paymentId =
      stringField(entitlement, "paymentId") ||
      stringField(entitlement, "payment_id");

    if (!paymentId) {
      return json({ error: "Invalid BOGO entitlement payment reference" }, 409);
    }

    const paymentDocument = await firestoreGet(
      `payments/${encodeURIComponent(paymentId)}`,
      accessToken,
    );

    if (!paymentDocument?.fields) {
      return json({ error: "The qualifying payment could not be found" }, 409);
    }

    const paymentData = firestoreDocumentData(paymentDocument);

    const paymentStatus = stringField(paymentData, "status");

    const paymentStudentId = stringField(paymentData, "student_id");

    const paymentCourseId = stringField(paymentData, "course_id");

    const paymentAmount = integerField(paymentData, "amount");

    if (
      paymentStatus !== "approved" ||
      paymentStudentId !== studentId ||
      paymentCourseId !== purchasedCourseId ||
      paymentAmount <= 0
    ) {
      return json(
        { error: "The qualifying payment is not valid for this BOGO claim" },
        409,
      );
    }

    if (!purchasedCourseId || purchasedRegularPrice <= 0) {
      return json({ error: "Invalid BOGO entitlement" }, 409);
    }

    if (targetCourseId === purchasedCourseId) {
      return json(
        {
          error:
            "The purchased course cannot be claimed as its own BOGO course",
        },
        400,
      );
    }

    const targetCourse = await firestoreGet(
      `courses/${encodeURIComponent(targetCourseId)}`,
      accessToken,
    );

    if (!targetCourse?.fields) {
      return json({ error: "Target course not found" }, 404);
    }

    if (!booleanField(targetCourse, "is_published")) {
      return json({ error: "Target course is not available" }, 409);
    }

    const targetRegularPrice = getRegularPrice(targetCourse, pricingConfig);

    if (targetRegularPrice <= 0 || targetRegularPrice > purchasedRegularPrice) {
      return json(
        {
          error: "The selected course is not eligible for this BOGO purchase",
        },
        409,
      );
    }

    const enrolmentId = `${studentId}_${targetCourseId}`;

    const existingEnrolment = await firestoreGet(
      `enrolments/${encodeURIComponent(enrolmentId)}`,
      accessToken,
    );

    if (
      existingEnrolment?.fields &&
      stringField(existingEnrolment, "status") === "active"
    ) {
      return json(
        {
          error: "You are already enrolled in this course",
        },
        409,
      );
    }

    const now = new Date().toISOString();

    const entitlementName = firestoreResource(
      "bogo_entitlements",
      entitlementId,
    );

    const claimId = `${entitlementId}_${targetCourseId}`;

    const claimName = firestoreResource("bogo_claims", claimId);

    const enrolmentName = firestoreResource("enrolments", enrolmentId);

    const writes = [
      {
        update: {
          name: claimName,
          fields: {
            entitlement_id: {
              stringValue: entitlementId,
            },
            payment_id: {
              stringValue:
                stringField(entitlement, "paymentId") ||
                stringField(entitlement, "payment_id"),
            },
            student_id: {
              stringValue: studentId,
            },
            purchased_course_id: {
              stringValue: purchasedCourseId,
            },
            target_course_id: {
              stringValue: targetCourseId,
            },
            target_course_name: {
              stringValue: stringField(targetCourse, "name"),
            },
            target_regular_price: {
              integerValue: String(targetRegularPrice),
            },
            claimed_at: {
              timestampValue: now,
            },
          },
        },
        currentDocument: {
          exists: false,
        },
      },
      {
        update: {
          name: enrolmentName,
          fields: {
            student_id: {
              stringValue: studentId,
            },
            course_id: {
              stringValue: targetCourseId,
            },
            course_name: {
              stringValue: stringField(targetCourse, "name"),
            },
            course_slug: {
              stringValue: stringField(targetCourse, "slug"),
            },
            status: {
              stringValue: "active",
            },
            pricing_mode: {
              stringValue: "bogo_free",
            },
            billing_period: {
              nullValue: null,
            },
            batch_number: {
              nullValue: null,
            },
            enrolled_at: {
              stringValue: now,
            },
            created_at: {
              timestampValue: now,
            },
          },
        },
        currentDocument: {
          exists: false,
        },
      },
      {
        update: {
          name: entitlementName,
          fields: {
            ...entitlement.fields,
            claimed: {
              booleanValue: true,
            },
            claimed_course_id: {
              stringValue: targetCourseId,
            },
            claimed_at: {
              timestampValue: now,
            },
          },
        },
        currentDocument: {
          updateTime: entitlementUpdateTime,
        },
      },
    ];

    await firestoreCommit(writes, accessToken);

    return json({
      ok: true,
      entitlementId,
      targetCourseId,
      targetCourseName: stringField(targetCourse, "name"),
      targetRegularPrice,
      claimedAt: now,
    });
  } catch (error) {
    console.error("bogo-claim error:", error);

    const message = error instanceof Error ? error.message : "";

    if (
      message.includes("JWT") ||
      message.includes("signature") ||
      message.includes("issuer") ||
      message.includes("audience")
    ) {
      return json(
        {
          error: "Invalid authentication token",
        },
        401,
      );
    }

    return json(
      {
        error: "Unexpected server error",
      },
      500,
    );
  }
});
