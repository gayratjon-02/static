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
	NOT_AUTHENTICATED = 'You are not authenticated, please login first!',
	TOKEN_NOT_EXIST = 'Bearer Token is not provided!',
	TOKEN_EXPIRED = 'Token has expired!',
	INVALID_TOKEN = 'Invalid token!',
	ONLY_SPECIFIC_ROLES_ALLOWED = 'Allowed only for members with specific roles!',
	NOT_ALLOWED_REQUEST = 'Not Allowed Request!',

	// User
	EMAIL_ALREADY_EXISTS = 'Email already exists!',
	USER_NOT_FOUND = 'User not found!',
	ACCOUNT_SUSPENDED = 'Your account has been suspended!',
	ACCOUNT_DELETED = 'Your account has been deleted!',
	WRONG_PASSWORD = 'Wrong password, try again!',

	// Upload
	PROVIDE_ALLOWED_FORMAT = 'Please provide jpg, jpeg, png or webp images!',
	FILE_TOO_LARGE = 'File size exceeds the limit!',

	// Credits
	INSUFFICIENT_CREDITS = 'Insufficient credits for this action!',

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
	BASIC = 'basic',
	PRO = 'pro',
	AGENCY = 'agency',
}

/** Subscription status */
export enum SubscriptionStatus {
	ACTIVE = 'active',
	INACTIVE = 'inactive',
	CANCELED = 'canceled',
	PAST_DUE = 'past_due',
	TRIALING = 'trialing',
}
