@echo off

call :ABSOLUTE_PATH    PROJECT_ROOT         %~dp0..\..\..
call :ABSOLUTE_PATH    PROJECT_SOURCE       %~dp0..\..

echo.
echo PROJECT_ROOT       = %PROJECT_ROOT%
echo PROJECT_SOURCE     = %PROJECT_SOURCE%
echo.

pushd "%PROJECT_SOURCE%" || goto :error

copy %PROJECT_SOURCE%\.env.example %PROJECT_SOURCE%\.env || goto :error

echo.
echo Environment has been initialized
echo.

popd

pause
exit /b

:error
pause
popd
exit /b 1

:ABSOLUTE_PATH
set %1=%~f2
exit /b

:FILENAME
set %1=%~n2%~x2
exit /b
