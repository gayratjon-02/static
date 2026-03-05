export enum Message {
	// General
	SOMETHING_WENT_WRONG = 'Something went wrong!',
	NO_DATA_FOUND = 'No data found!',
	NO_BRAND_FOUND = 'No brand found!',
	CREATE_FAILED = 'Create failed!',
	UPDATE_FAILED = 'Update failed!',
	REMOVE_FAILED = 'Remove failed!',
	UPLOAD_FAILED = 'Upload failed!',
	BAD_REQUEST = 'Bad Request',

	// Auth
	EMAIL_IS_REQUIRED = 'Email is required!',
	NOT_AUTHENTICATED = 'You are not authenticated, please login first!',
	TOKEN_NOT_EXIST = 'Bearer Token is not provided!',
	TOKEN_EXPIRED = 'Token has expired!',
	INVALID_TOKEN = 'Invalid token!',
	ONLY_SPECIFIC_ROLES_ALLOWED = 'Allowed only for members with specific roles!',
	NOT_ALLOWED_REQUEST = 'Not Allowed Request!',
	PASSWORDS_DO_NOT_MATCH = 'Passwords do not match!',
	INVALID_TOKEN_PURPOSE = 'Invalid token purpose!',
	INVALID_OR_EXPIRED_RESET_TOKEN = 'Invalid or expired reset token!',
	PASSWORD_RESET_FAILED = 'Failed to reset password!',
	PASSWORD_RESET_SUCCESS = 'Password has been successfully reset.',
	PASSWORD_RESET_EMAIL_SENT = 'If an account exists, a reset email will be sent.',

	// Google Auth
	GOOGLE_AUTH_FAILED = 'Google authentication failed!',
	GOOGLE_EMAIL_NOT_VERIFIED = 'Google email is not verified!',
	USE_GOOGLE_SIGN_IN = 'This account uses Google Sign-In. Please sign in with Google.',
	USE_EMAIL_SIGN_IN = 'This account uses email sign-in. Please sign in with your email and password.',

	// User
	EMAIL_ALREADY_EXISTS = 'Email already exists!',
	USER_NOT_FOUND = 'User not found!',
	ACCOUNT_SUSPENDED = 'Your account has been suspended!',
	ACCOUNT_DELETED = 'Your account has been deleted!',
	WRONG_PASSWORD = 'Wrong password, try again!',
	NEW_PASSWORD_SAME_AS_OLD = 'New password must be different from your current password.',
	NO_ACTIVE_SUBSCRIPTION = 'No active subscription. Please purchase a plan to access Static Engine.',
	SUBSCRIPTION_EXPIRED = 'Your subscription has expired or is past due. Please renew your plan.',

	// Upload
	PROVIDE_ALLOWED_FORMAT = 'Please provide jpg, jpeg, png or webp images!',
	FILE_TOO_LARGE = 'File size exceeds the limit!',

	// Credits
	INSUFFICIENT_CREDITS = 'Insufficient credits for this action!',
	CREDITS_LOW = 'You have used 80% of your credits. Consider upgrading or purchasing add-on credits.',
	CREDITS_CRITICAL = 'Almost out of credits! Only a few generations left.',
	CREDITS_DEPLETED = 'No credits remaining. Upgrade your plan or purchase add-on credits to continue.',

	// Brand / Product
	BRAND_LIMIT_REACHED = 'You have reached the maximum number of brands for your tier!',
	PRODUCT_LIMIT_REACHED = 'You have reached the maximum number of products!',

	// Generation
	GENERATION_STARTED = 'Generation started successfully!',
	GENERATION_FAILED = 'Generation failed, please try again!',
	BRAND_NOT_FOUND = 'Brand not found or does not belong to you!',
	PRODUCT_NOT_FOUND = 'Product not found or does not belong to this brand!',
	CONCEPT_NOT_FOUND = 'Concept not found!',
	GENERATION_NOT_FOUND = 'Generation not found or does not belong to you!',
	GENERATION_NOT_COMPLETED = 'Generation is not completed yet!',

	// Canva
	AD_NOT_FOUND = 'Ad not found or does not belong to you!',
	CANVA_ORDER_CREATE_FAILED = 'Failed to create Canva order!',
	CANVA_ORDER_NOT_FOUND = 'Canva order not found!',
	CANVA_ORDER_ALREADY_FULFILLED = 'Canva order is already fulfilled!',
	CANVA_ORDER_UPDATE_FAILED = 'Failed to update Canva order!',
	CANVA_ORDERS_LOAD_FAILED = 'Failed to load Canva orders!',
}

/** User account status */
export enum MemberStatus {
	ACTIVE = 'active',
	INACTIVE = 'inactive',
	SUSPENDED = 'suspended',
	DELETED = 'deleted',
}

/** Auth provider type (PDF: email + Google only) */
export enum MemberAuthType {
	EMAIL = 'email',
	GOOGLE = 'google',
}

/** Admin panel roles */
export enum AdminRole {
	SUPER_ADMIN = 'super_admin',
	CONTENT_ADMIN = 'content_admin',
	SUPPORT = 'support',
}

/** Subscription tiers (user access levels) */
export enum SubscriptionTier {
	FREE = 'free',
	STARTER = 'starter',
	PRO = 'pro',
	GROWTH = 'growth',
}

/** Subscription status */
export enum SubscriptionStatus {
	ACTIVE = 'active',
	INACTIVE = 'inactive',
	CANCELED = 'canceled',
	PAST_DUE = 'past_due',
	TRIALING = 'trialing',
}

/** Canva order status */
export enum CanvaOrderStatus {
	PENDING = 'pending',
	IN_PROGRESS = 'in_progress',
	FULFILLED = 'fulfilled',
	REFUNDED = 'refunded',
}
