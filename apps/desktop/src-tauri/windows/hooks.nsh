; Deco NSIS hooks — remove duplicate desktop shortcuts; Tauri recreates the canonical Deco.lnk on finish.
!macro NSIS_HOOK_POSTINSTALL
  Call PruneDecoShortcutsInFolder
  ReadEnvStr $R9 "PUBLIC"
  StrCpy $R1 "$R9\Desktop"
  Call PruneDecoShortcutsAtPath
!macroend

Function PruneDecoShortcutsInFolder
  StrCpy $R1 "$DESKTOP"
  Call PruneDecoShortcutsAtPath
FunctionEnd

Function PruneDecoShortcutsAtPath
  Push $R0
  Push $R2
  FindFirst $R0 $R2 "$R1\Deco*.lnk"
  loop:
    StrCmp $R2 "" done
    Delete "$R1\$R2"
    FindNext $R0 $R2
    Goto loop
  done:
  FindClose $R0
  Pop $R2
  Pop $R0
FunctionEnd
