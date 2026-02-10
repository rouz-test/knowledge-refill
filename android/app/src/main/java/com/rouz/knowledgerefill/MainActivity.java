package com.rouz.knowledgerefill;

import android.os.Bundle;

import androidx.appcompat.app.AppCompatDelegate;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
    protected void onCreate(Bundle savedInstanceState) {
    AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES);
    super.onCreate(savedInstanceState);

    int id = getResources().getIdentifier(
        "ic_stat_refill",
        "drawable",
        getPackageName()
    );
    android.util.Log.e("KR_NOTI", "ic_stat_refill drawable id=" + id);
    }
}
