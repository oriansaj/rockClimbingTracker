/**
 * @fileoverview
 * Provides the JavaScript interactions for all pages.
 *
 * @author 
 * Andrew Orians, Sam Dunaway
 */

/** namespace. */
var rhit = rhit || {};

rhit.FB_COLLECTION_USERS = "Users";
rhit.FB_COLLECTION_ROUTES = "Routes";
rhit.FB_KEY_ROUTES = "routes";
rhit.FB_KEY_NOTES = "notes";
rhit.FB_KEY_START_DATES = "startDates";
rhit.FB_KEY_IN_PROGRESS = "inProgress";
rhit.fbAuthManager = null;
rhit.fbRoutesManager = null;
rhit.fbSingleRouteManager = null;
rhit.fbStatsManager = null;

function htmlToElement(html) {
	var template = document.createElement("template");
	html = html.trim();
	template.innerHTML = html;
	return template.content.firstChild;
}

rhit.FbAuthManager = class {
	constructor() {
		this._user = null;
		this._userDoc = null;
		this._unsubscribe = null;
		this._ref = firebase.firestore().collection(rhit.FB_COLLECTION_USERS);
	}
	beginListening(changeListener) {
		firebase.auth().onAuthStateChanged((user) => {
			this._user = user;
			if (this._user) {
				this._unsubscribe = this._ref.doc(this._user.uid).onSnapshot((doc) => {
					if (!doc.exists) {
						this._ref.doc(this._user.uid).set({
								[rhit.FB_KEY_ROUTES]: [],
								[rhit.FB_KEY_NOTES]: [],
								[rhit.FB_KEY_START_DATES]: [],
								[rhit.FB_KEY_IN_PROGRESS]: []
							})
							.then(() => {
								console.log("User successfully added!");
							})
							.catch((error) => {
								console.log("Error creating user: ", error);
							});
					}
					this._userDoc = this._ref.doc(this._user.uid);
				});
			}
			changeListener();
		});
	}
	signOut() {
		firebase.auth().signOut().then(function () {
			console.log("You are now signed out");
		}).catch(function (error) {
			// An error happened.
			console.log("Sign out error");
		});
	}
	get isSignedIn() {
		return !!this._user;
	}
	get uid() {
		return this._user.uid;
	}
}

rhit.checkForRedirects = function () {
	if (document.querySelector("#loginPage") && rhit.fbAuthManager.isSignedIn) {
		window.location.href = `/list.html?uid=${rhit.fbAuthManager.uid}`;
	}

	if (!document.querySelector("#loginPage") && !rhit.fbAuthManager.isSignedIn) {
		window.location.href = "/";
	}
}

rhit.initializePage = function () {
	if (document.querySelector("#loginPage")) {
		rhit.startFirebaseUI();
	}

	// if (document.querySelector("#listPage")) {
	// 	const urlParams = new URLSearchParams(window.location.search);
	// 	const userId = urlParams.get("uid");

	// 	rhit.fbPhotoBucketManager = new rhit.FbPhotoBucketManager(userId);
	// 	new rhit.ListPageController();
	// }

	// if (document.querySelector("#detailPage")) {
	// 	const urlParams = new URLSearchParams(window.location.search);
	// 	const photoId = urlParams.get("id");
	// 	if (!photoId) {
	// 		window.location.href = "/";
	// 	}
	// 	rhit.fbSinglePhotoManager = new rhit.FbSinglePhotoManager(photoId);
	// 	new rhit.DetailPageController();
	// }
}

/* Main */
/** function and class syntax examples */
rhit.main = function () {
	console.log("Ready");

	rhit.fbAuthManager = new rhit.FbAuthManager();
	rhit.fbAuthManager.beginListening(() => {
		rhit.checkForRedirects();
		rhit.initializePage();
	});
};

rhit.startFirebaseUI = function () {
	// FirebaseUI config.
	var uiConfig = {
		signInSuccessUrl: '/',
		signInOptions: [
			firebase.auth.GoogleAuthProvider.PROVIDER_ID,
			firebase.auth.EmailAuthProvider.PROVIDER_ID
		],
	};

	// Initialize the FirebaseUI Widget using Firebase.
	const ui = new firebaseui.auth.AuthUI(firebase.auth());
	// The start method will wait until the DOM is loaded.
	ui.start('#firebaseui-auth-container', uiConfig);
};

rhit.main();