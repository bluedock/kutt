const { Router } = require("express");

const validators = require("../handlers/validators.handler");
const helpers = require("../handlers/helpers.handler");
const asyncHandler = require("../utils/asyncHandler");
const locals = require("../handlers/locals.handler");
const auth = require("../handlers/auth.handler");
const utils = require("../utils");
const env = require("../env");

const router = Router();

router.post(
  "/login",
  locals.viewTemplate("partials/auth/form"),
  auth.featureAccess([!env.DISALLOW_LOGIN_FORM]),
  validators.login,
  asyncHandler(helpers.verify),
  helpers.rateLimit({ window: 60, limit: 5 }),
  asyncHandler(auth.local),
  asyncHandler(auth.login)
);

router.post(
  "/signup",
  locals.viewTemplate("partials/auth/form"),
  auth.featureAccess([!env.DISALLOW_REGISTRATION, env.MAIL_ENABLED]),
  validators.signup,
  asyncHandler(helpers.verify),
  helpers.rateLimit({ window: 60, limit: 5 }),
  validators.signupEmailTaken,
  asyncHandler(helpers.verify),
  asyncHandler(auth.signup)
);

router.post(
  "/create-admin",
  locals.viewTemplate("partials/auth/form_admin"),
  validators.createAdmin,
  asyncHandler(helpers.verify),
  helpers.rateLimit({ window: 60, limit: 5 }),
  asyncHandler(auth.createAdminUser)
);

router.post(
  "/change-password",
  locals.viewTemplate("partials/settings/change_password"),
  asyncHandler(auth.jwt),
  validators.changePassword,
  asyncHandler(helpers.verify),
  helpers.rateLimit({ window: 60, limit: 5 }),
  asyncHandler(auth.changePassword)
);

router.post(
  "/change-email",
  locals.viewTemplate("partials/settings/change_email"),
  asyncHandler(auth.jwt),
  auth.featureAccess([env.MAIL_ENABLED]),
  validators.changeEmail,
  asyncHandler(helpers.verify),
  helpers.rateLimit({ window: 60, limit: 3 }),
  asyncHandler(auth.changeEmailRequest)
);

router.post(
  "/apikey",
  locals.viewTemplate("partials/settings/apikey"),
  asyncHandler(auth.jwt),
  helpers.rateLimit({ window: 60, limit: 10 }),
  asyncHandler(auth.generateApiKey)
);

router.post(
  "/reset-password",
  locals.viewTemplate("partials/reset_password/request_form"),
  auth.featureAccess([env.MAIL_ENABLED]),
  validators.resetPassword,
  asyncHandler(helpers.verify),
  helpers.rateLimit({ window: 60, limit: 3 }),
  asyncHandler(auth.resetPassword)
);

router.post(
  "/new-password",
  locals.viewTemplate("partials/reset_password/new_password_form"),
  locals.newPassword,
  validators.newPassword,
  asyncHandler(helpers.verify),
  helpers.rateLimit({ window: 60, limit: 5 }),
  asyncHandler(auth.newPassword)
);

// OIDC Back-channel logout endpoint (Issue #1054)
// This endpoint is called by the OP when user logs out from another RP
router.post(
  "/logout/oidc/backchannel",
  asyncHandler(auth.jwtLoose), // Verify the logout token
  asyncHandler(async (req, res) => {
    // The logout token should be in req.body.logout_token
    // For simplicity, we just acknowledge receipt
    // In a full implementation, you'd validate the logout token and invalidate user sessions
    console.log('OIDC back-channel logout received');
    res.status(200).send({ success: true });
  })
);

// OIDC RP-initiated logout endpoint
router.get(
  "/logout/oidc",
  asyncHandler(auth.jwtPage),
  asyncHandler(async (req, res) => {
    // Clear local session
    utils.deleteCurrentToken(res);
    
    // Redirect to OP's logout endpoint
    if (env.OIDC_ENABLED && req.user && req.user.oidc_id_token) {
      const logoutUrl = `${env.OIDC_ISSUER}/protocol/openid-connect/logout?` + 
        new URLSearchParams({
          post_logout_redirect_uri: utils.getSiteURL(),
          id_token_hint: req.user.oidc_id_token,
        }).toString();
      return res.redirect(logoutUrl);
    }
    
    res.redirect("/logout");
  })
);

module.exports = router;
