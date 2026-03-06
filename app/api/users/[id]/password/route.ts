/**
 * PATCH /api/users/[id]/password
 * DEPRECATED: Password management is no longer supported.
 * Auth relies solely on OTP (One-Time Password).
 */
export async function PATCH() {
  return Response.json(
    { error: 'Password management is no longer supported. Auth uses OTP only.' },
    { status: 410 }
  );
}
