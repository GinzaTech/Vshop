# VShop
<a href="https://github.com/VShopApp/mobile/releases/latest/download/VShop.apk">
  <img alt="GitHub release (latest by date and asset)" src="https://img.shields.io/github/downloads/VShopApp/mobile/latest/VShop.apk?label=APK&color=%23fa4454&logo=android&logoColor=white">
</a>

# Installation

This document provides instructions on how to set up your environment to work with a React Native application.

## Install Environment

To ensure your system is ready for React Native development, please verify the following dependencies and settings:

### 1. **ADB (Android Debug Bridge)**

Install the Android Debug Bridge (ADB) to interact with connected Android devices. [here](https://dl.google.com/android/repository/platform-tools-latest-windows.zip)

B1: Add the platform-tools directory to your system PATH:
- Open setting.
- Click on System.
- Click on About.
- Click on Advanced system settings.
- Click on Environment variables.
- Under the "System variables" section, select or search Path variable, and click the Edit button.
- Paste the path to the platform-tools directory, and click the OK button.
- You should place platform-tools in drive C and copy the path C://platform-tools.

B2: Open a command prompt and run the following command to verify the installation:
If you run adb devices and it shows the device name like this, you have successfully connected your device to your computer.
```bash
adb devices
List of devices attached
45218ba device 
```
If it doesn't show the device name, you should install the ADB driver on your computer to properly recognize your phone. like this
```bash
adb devices
List of devices attached
```
### 2. **JDK (Java Development Kit)**
- **Install**:
    - [Download JDK](https://www.oracle.com/java/technologies/javase-jdk17-downloads.html).
    - Set the `JAVA_HOME` environment variable to the JDK installation path.
    - Add the JDK `bin` directory to the system `PATH` environment variable.
    - Verify the installation by running `java -version` in a terminal.

### 3. **Android Studio**
- **Install**:
    - Install the latest version of [Android Studio](https://developer.android.com/studio).
    - Configure the Android SDK during the installation process.
    - Set the `ANDROID_HOME` environment variable to the Android SDK installation path.

### 4. **Node.js**
- **Install**:
    - [Download Node.js](https://nodejs.org/dist/v22.12.0/node-v22.12.0-x64.msi).
    - Verify the installation by running `node -v` and `npm -v` in a terminal.
  
### 5. **Expo orbit**
- **Install**:
    - [Download Expo orbit](https://github.com/expo/orbit/releases/download/expo-orbit-v2.0.1/Expo.Orbit-2.0.1-x64.Setup.exe).
- **Create account**:
    - Open the chrome and create an account. [here](https://expo.dev/signup)
    - After creating an account, you can log in to the Expo with terminal.
    - Run `expo login` in a terminal.
    - Enter your email and password.
    - You can check your login status by running `expo whoami` in a terminal.
    - If you are logged in, you will see your username.
    - If you are not logged in, you will see "Not logged in".
---
## Start the project
### 1. **Clone the repository**
```bash
git clone link
```
### 2. **Install dependencies**
```bash
npm install
npm install -g eas-cli
```
### 3. **Start the project**
```bash
npm start
```

### Match UI development preview

Match History and Match Detail normally use the signed-in Riot account. A complete mock data set is also available in development builds so the layout can be checked without changing API responses:

```text
/history?demo=1
/match_details/mock-match-001?demo=1
```

The mock includes 25 rounds for horizontal timeline and economy-chart testing. Production builds ignore the `demo` query parameter.

2. **Create Project in Expo**
- Go to the [Expo website](https://expo.dev/) and create a new project.
- Click on the "Project" button.
- Click on the "Create new project" button.
- Enter the project name and click on the "Create project" button.
- Run command
```bash
npm install --global eas-cli
```
and 
```bash
eas init --id your project id
```
3. **Build Internal App**
- Run command
- If you see any question y/n you can press y
- And wait for the build to finish
- You need to connect your phone to your computer, enable USB debugging, connect both devices to the same Wi-Fi network
- Install Expo Go on your phone.
```bash
eas build --profile development --platform android
```
The build process for the development version can take some time, so please be patient. Once the build is complete, you can install it on your device and make any changes you desire.

4. **Install App**
- Click Dashboard on the Expo website, you can see Projects and click on the project you want to install.
- Click Android internal distribution build
- Click on the "Install" button.
- Scan your QR code or use url to install the app on your phone.
- You can also download the APK file and install it on your phone.

5. **Android public release build**
- Run command
```bash
eas build --platform android
```

VShop allows you to check your game Store, Night Market, Profile and more. It runs entirely on your device and securely transmits your credentials to the official Riot Games servers (more information in our <a href="https://docs.vshop.one/security">docs</a>).

## Translations
Translations are available on [Weblate](https://hosted.weblate.org/projects/vshop/mobile/).<br>
<a href="https://hosted.weblate.org/engage/vshop/">
<img src="https://hosted.weblate.org/widget/vshop/mobile/multi-red.svg" alt="Translation status" />
</a>

## Credits
This app would not have been possible without the following projects:
- [Unofficial API documentation](https://github.com/techchrism/valorant-api-docs)
- [In-Game assets](https://valorant-api.com) 

I would also like to thank all of our translations and other projects members, which are listed on the [credits page](https://vshop.one/credits) 💖
