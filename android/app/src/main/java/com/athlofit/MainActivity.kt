package com.athlofit

import android.os.Bundle
import com.swmansion.rnscreens.fragment.restoration.RNScreensFragmentFactory

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import dev.matinzd.healthconnect.permissions.HealthConnectPermissionDelegate

import com.zoontek.rnbootsplash.RNBootSplash

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "Athlofit"


  override fun onCreate(savedInstanceState: Bundle?) {
     RNBootSplash.init(this, R.style.BootTheme)
    supportFragmentManager.fragmentFactory = RNScreensFragmentFactory()
    super.onCreate(savedInstanceState)
    // Must stay in onCreate: registerForActivityResult() is only legal before
    // the Activity reaches STARTED, and the launcher it returns is owned by
    // this Activity's result registry. Every recreation re-registers, which is
    // what keeps the (process-scoped) delegate pointing at a live host.
    HealthConnectPermissionDelegate.setPermissionDelegate(this)
  }

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    // Forward to StepPermissionManager for ACTIVITY_RECOGNITION handling
    StepPermissionManager.onRequestPermissionsResult(requestCode, grantResults)
  }
}
