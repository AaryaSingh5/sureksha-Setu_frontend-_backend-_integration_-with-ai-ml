package com.suraksha.setu;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.suraksha.setu.plugins.SurakshaBlePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SurakshaBlePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
