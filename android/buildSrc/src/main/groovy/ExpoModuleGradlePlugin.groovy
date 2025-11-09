import org.gradle.api.Plugin
import org.gradle.api.Project

class ExpoModuleGradlePlugin implements Plugin<Project> {
    @Override
    void apply(Project project) {
        // Apply the ExpoModulesCorePlugin.gradle script
        def expoModulesCorePlugin = new File(project.rootProject.projectDir, "../node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle")
        if (expoModulesCorePlugin.exists()) {
            project.apply from: expoModulesCorePlugin
            
            // Call the extension methods immediately
            if (project.ext.has('applyKotlinExpoModulesCorePlugin')) {
                project.ext.applyKotlinExpoModulesCorePlugin()
            }
            if (project.ext.has('useDefaultAndroidSdkVersions')) {
                project.ext.useDefaultAndroidSdkVersions()
            }
            if (project.ext.has('useCoreDependencies')) {
                project.ext.useCoreDependencies()
            }
        }
    }
}

